// probe.gl, MIT license
/* eslint-disable camelcase */

import {ScreenshotOptions, Page} from 'puppeteer';
import fs from 'fs';
import {COLOR, addColor} from '@probe.gl/log';
import diffImages, {DiffImagesOptions} from '../utils/diff-images';
import * as eventDispatchers from '../utils/puppeteer-events';
import BrowserDriver, {ServerConfiguration} from './browser-driver';

declare global {
  function browserTestDriver_fail(): void;
  function browserTestDriver_finish(): string;
  function browserTestDriver_emulateInput(event: unknown): void;
  function browserTestDriver_captureAndDiffScreen(opts: DiffImagesOpts): Promise<DiffImageResult>;
}

const MAX_CONSOLE_MESSAGE_LENGTH = 500;

type BrowserTestDriverProps = {
  title?: string;
  headless?: boolean;
  maxConsoleMessageLength?: number;
  server: ServerConfiguration;
  browser?: object;
  exposeFunctions?: any;
  url?: string;
  onStart?: (params: {page: Page}) => void | Promise<void>;
  onFinish?: (params: {page: Page; isSuccessful: boolean}) => void | Promise<void>;
};

export type DiffImagesOpts = DiffImagesOptions & {
  goldenImage: string;
  region?: any;
  saveOnFail?: boolean;
  saveAs?: string;
};

/** @todo this seems like just a light repackaging of the underlying result type. Reuse or better separation of types? */
export type DiffImageResult = {
  headless: boolean;
  match: string | number;
  matchPercentage: string;
  success: boolean;
  error: Error | string | null;
};

declare global {
  function browserTestDriver_fail(): void;
  function browserTestDriver_finish(): string;
  function browserTestDriver_emulateInput(event: unknown): void;
  function browserTestDriver_captureAndDiffScreen(opts: DiffImagesOpts): Promise<DiffImageResult>;
}

/** A test driver that starts a browser instance and runs tests inside it */
export default class BrowserTestDriver extends BrowserDriver {
  title: string = '';
  headless: boolean = false;
  time: number = Date.now();
  failures: number = 0;
  maxConsoleMessageLength = MAX_CONSOLE_MESSAGE_LENGTH;

  async run(config: BrowserTestDriverProps): Promise<void> {
    const {
      title = 'Browser Test',
      headless = false,
      maxConsoleMessageLength = MAX_CONSOLE_MESSAGE_LENGTH
    } = config;
    this.title = title;
    this.headless = headless;
    this.maxConsoleMessageLength = maxConsoleMessageLength;

    this.logger.log({
      message: `${title}`,
      color: COLOR.BRIGHT_YELLOW
    })();

    try {
      const url = await this.startServer(config.server);
      if (!url) {
        return;
      }

      const result = await this._openPage(url, config);

      await config.onFinish?.({
        // @ts-ignore this.page is always populated after _openPage
        page: this.page,
        isSuccessful: this.failures === 0
      });

      this._onFinish(result);
    } catch (error: unknown) {
      this._fail((error as Error).message || 'puppeteer run failes');
    }
  }

  _openPage(url: string, config: BrowserTestDriverProps): Promise<string> {
    const browserConfig = Object.assign({}, config.browser, {headless: this.headless});

    return this.startBrowser(browserConfig).then(
      _ =>
        new Promise<string>(async (resolve, reject) => {
          const exposeFunctions = {
            ...config.exposeFunctions,
            browserTestDriver_fail: () => this.failures++,
            browserTestDriver_finish: message => resolve(message),
            browserTestDriver_emulateInput: event => this._emulateInput(event),
            browserTestDriver_captureAndDiffScreen: opts => this._captureAndDiff(opts)
          };

          // Puppeteer can only inject functions, not values, into the global scope
          // In headless mode, we inject the function so it's truthy
          // In non-headless mode, we don't inject the function so it's undefined
          if (this.headless) {
            exposeFunctions.browserTestDriver_isHeadless = () => true;
          }

          this.logger.log({
            message: 'Loading page in browser...',
            color: COLOR.BRIGHT_YELLOW
          })();

          // resolve URL
          const pageUrl: string = config.url
            ? config.url.startsWith('http')
              ? config.url
              : `${url.replace(/\/$/, '')}/${config.url.replace(/^\//, '')}`
            : url;

          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          const page = await this.openPage({
            exposeFunctions,
            onConsole: event => this._onConsole(event),
            onError: reject
          });

          await config.onStart?.({page});

          await page.goto(pageUrl);
        })
    );
  }

  /* eslint-disable no-console */
  _onConsole(event) {
    if (!this.headless) {
      // Do not mirror console messages if the browser is open
      return;
    }

    // Terminal console does not collapse big messages like Chrome does
    // Crop very long text messages to avoid flooding
    let text = event.text();
    if (!text.startsWith('data:')) {
      // Leave data URL intact so that we have a channel to get data out via console
      text = text.slice(0, this.maxConsoleMessageLength);
    }
    switch (event.type()) {
      case 'log':
        console.log(text);
        break;

      case 'warning':
        console.log(addColor(text, COLOR.YELLOW));
        break;

      case 'error':
        console.log(addColor(text, COLOR.RED));
        break;

      default:
      // ignore
    }
  }
  /* eslint-enable no-console */

  _onFinish(message: string): void {
    const elapsed = ((Date.now() - this.time) / 1000).toFixed(1);
    this.logger.log({
      message: `${this.title} completed in ${elapsed}s.`,
      color: COLOR.BRIGHT_YELLOW
    })();

    if (this.failures) {
      this._fail(message || `${this.failures} test${this.failures > 1 ? 's' : ''} failed`);
    } else {
      this._pass(message || 'All tests passed');
    }
  }

  _pass(message: string): void {
    this.logger.log({
      message: `${this.title} successful: ${message}`,
      color: COLOR.BRIGHT_GREEN
    })();

    if (this.headless) {
      this.exit(0); // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  }

  _fail(message: string): void {
    this.logger.log({
      message: `${this.title} failed: ${message}`,
      color: COLOR.BRIGHT_RED
    })();

    if (this.headless) {
      this.exit(1); // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  }

  _emulateInput(event) {
    // eslint-disable-next-line import/namespace
    if (eventDispatchers[event.type]) {
      // eslint-disable-next-line import/namespace
      return eventDispatchers[event.type](this.page, event);
    }
    throw new Error(`Unknown event: ${event.type}`);
  }

  async _captureAndDiff(opts: DiffImagesOpts): Promise<DiffImageResult> {
    if (!opts.goldenImage) {
      return Promise.reject(new Error('Must supply golden image for image diff'));
    }

    const screenshotOptions: ScreenshotOptions = {
      type: 'png',
      omitBackground: true,
      encoding: 'binary'
    };
    if (opts.region) {
      screenshotOptions.clip = opts.region;
    } else {
      screenshotOptions.fullPage = true;
    }

    try {
      const image = await this.page?.screenshot(screenshotOptions);
      if (!image) {
        throw new Error('screenshot failed');
      }
      const result = await diffImages(image, opts.goldenImage, opts);
      if (!result.success && opts.saveOnFail && result.source1) {
        let filename = opts.saveAs || '[name]-failed.png';
        filename = filename.replace('[name]', opts.goldenImage.replace(/\.\w+$/, ''));
        this._saveScreenshot(filename, result.source1);
      }
      return {
        headless: this.headless,
        match: result.match || 0,
        matchPercentage: result.matchPercentage || 'N/A',
        success: result.success,
        // @ts-expect-error
        diffImage: result.diffImage || null,
        error: result.error || null
      };
    } catch (error: unknown) {
      return {
        headless: this.headless,
        match: 0,
        matchPercentage: 'N/A',
        success: false,
        error: (error as Error).message
      };
    }
  }

  _saveScreenshot(filename, data) {
    this.logger.log({
      message: `Writing screenshot to ${filename}`,
      color: COLOR.BRIGHT_YELLOW
    })();
    fs.writeFile(filename, data, error => {
      if (error) {
        this.logger.log({
          message: `Save screenshot failed: ${error.message}`,
          color: COLOR.BRIGHT_RED
        })();
      }
    });
  }
}
