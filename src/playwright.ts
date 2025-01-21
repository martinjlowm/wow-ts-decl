export class Selector {
  pageTitle = 'h1';
  description = '> p:first-of-type';

  overrides: Omit<Record<string, Partial<Record<keyof Selector, string>>>, 'overrides'> = {
    API_OpenAllBags: {
      pageTitle: '#mw-content-text > .mw-parser-output > ul:first-of-type > li:nth-child(1)',
      description: '> ul:first-of-type > li:nth-child(1)',
    },
    // CloseAllBags redirects to OpenAllBags where it and two other functions are
    // listed in a bullet list
    API_CloseAllBags: {
      pageTitle: '#mw-content-text > .mw-parser-output > ul:first-of-type > li:nth-child(2)',
      description: '> ul:first-of-type > li:nth-child(2)',
    },
    API_ToggleAllBags: {
      pageTitle: '#mw-content-text > .mw-parser-output > ul:first-of-type > li:nth-child(3)',
      description: '> ul:first-of-type > li:nth-child(3)',
    },
    API_OpenBackpack: {
      pageTitle: '#mw-content-text > .mw-parser-output > ul:first-of-type > li:nth-child(1)',
      description: '> ul:first-of-type > li:nth-child(1)',
    },
    API_CloseBackpack: {
      pageTitle: '#mw-content-text > .mw-parser-output > ul:first-of-type > li:nth-child(2)',
      description: '> ul:first-of-type > li:nth-child(2)',
    },
    API_OpenBag: {
      pageTitle: '#mw-content-text > .mw-parser-output > ul:first-of-type > li:nth-child(1)',
      description: '> ul:first-of-type > li:nth-child(1)',
    },
    API_CloseBag: {
      pageTitle: '#mw-content-text > .mw-parser-output > ul:first-of-type > li:nth-child(2)',
      description: '> ul:first-of-type > li:nth-child(2)',
    },
    API_GMRequestPlayerInfo: {
      description: '> h2 ~ dl',
    },
    API_GetNumDisplayChannels: {
      description: '> h2 ~ ul',
    },
    API_GetQuestFactionGroup: {
      description: '> pre',
    },
    API_GetRepairAllCost: {
      description: '> h2:nth-of-type(2) ~ dl',
    },
    API_GetWorldElapsedTime: {
      description: '> h2:nth-of-type(3) ~ ul',
    },
    // Example is above the snippet and there's a empty paragraph at the top of
    // the page :shrug:
    API_ChatFrame_AddChannel: {
      description: '> p:nth-of-type(2)',
    },
  };

  overridable(resource: string, section: keyof Omit<Selector, 'overrides' | 'overridable'>) {
    const defaultSelector = this[section];

    const selectors = resource in this.overrides && this.overrides[resource];
    if (!selectors) {
      return defaultSelector;
    }

    const selector = section in selectors && selectors[section];
    if (!selector) {
      return defaultSelector;
    }

    return selector;
  }
}

type FormatFunction = (str: string | null) => string;
export class Formatter {
  pageTitle: FormatFunction = (str) => str?.trim() || '';
  description: FormatFunction = (str) => str?.trim() || '';

  overrides: Omit<Record<string, Partial<Record<keyof Selector, FormatFunction>>>, 'overrides'> = {
    // CloseAllBags redirects to OpenAllBags where it and two other functions are
    // listed in a bullet list
    API_CloseAllBags: {
      pageTitle: (str) => {
        if (!str) {
          return '';
        }

        const [left] = str.split('()');
        return left;
      },
      description: (str) => {
        if (!str) {
          return '';
        }

        const [, ...rhs] = str.split(' ');
        return rhs.join(' ');
      },
    },
    API_CloseBackpack: {
      pageTitle: (str) => {
        if (!str) {
          return '';
        }

        const [left] = str.split('()');
        return left;
      },
      description: (str) => {
        if (!str) {
          return '';
        }

        const [, ...rhs] = str.split(' ');
        return rhs.join(' ');
      },
    },
    API_CloseBag: {
      pageTitle: (str) => {
        if (!str) {
          return '';
        }

        const [left] = str.split('()');
        return left;
      },
      description: (str) => {
        if (!str) {
          return '';
        }

        const [, ...rhs] = str.split(' ');
        return rhs.join(' ');
      },
    },
    API_ChatFrame_AddChannel: {
      pageTitle: (str) => {
        if (!str) {
          return '';
        }

        const [left] = str.split('()');
        return left;
      },
    },
  };

  overridable(resource: string, section: keyof Omit<Selector, 'overrides' | 'overridable'>) {
    const defaultSelector = this[section];

    const selectors = resource in this.overrides && this.overrides[resource];
    if (!selectors) {
      return defaultSelector;
    }

    const selector = section in selectors && selectors[section];
    if (!selector) {
      return defaultSelector;
    }

    return selector;
  }
}
