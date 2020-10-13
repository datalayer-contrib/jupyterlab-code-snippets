import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';
import { ICommandPalette, WidgetTracker } from '@jupyterlab/apputils';
import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { IEditorServices } from '@jupyterlab/codeeditor';
import { LabIcon } from '@jupyterlab/ui-components';

import { Widget } from '@lumino/widgets';
import { find } from '@lumino/algorithm';

import editorIconSVGstr from '../style/icon/jupyter_snippeteditoricon.svg';
import codeSnippetIconSVGstr from '../style/icon/jupyter_snippeticon.svg';

import { CodeSnippetInputDialog } from './CodeSnippetInputDialog';
import { CodeSnippetWidget } from './CodeSnippetWidget';
import { CodeSnippetContentsService } from './CodeSnippetContentsService';
import {
  CodeSnippetEditor,
  ICodeSnippetEditorMetadata
} from './CodeSnippetEditor';
import {
  /*NotebookPanel,*/
  /*NotebookActions,*/
  NotebookTracker
} from '@jupyterlab/notebook';
//import { ReadonlyPartialJSONObject } from '@lumino/coreutils';

const CODE_SNIPPET_EXTENSION_ID = 'code-snippet-extension';

const CODE_SNIPPET_SETTING_ID = 'jupyterlab-code-snippets:settings';
/**
 * Snippet Editor Icon
 */
const editorIcon = new LabIcon({
  name: 'custom-ui-compnents:codeSnippetEditorIcon',
  svgstr: editorIconSVGstr
});

/**
 * Snippet Icon
 */
const codeSnippetIcon = new LabIcon({
  name: 'custom-ui-compnents:codeSnippetIcon',
  svgstr: codeSnippetIconSVGstr
});

/**
 * Initialization data for the code_snippets extension.
 */
const code_snippet_extension: JupyterFrontEndPlugin<void> = {
  id: CODE_SNIPPET_EXTENSION_ID,
  autoStart: true,
  requires: [ICommandPalette, ILayoutRestorer, IEditorServices],
  activate: activateCodeSnippet
};

function activateCodeSnippet(
  app: JupyterFrontEnd,
  palette: ICommandPalette,
  restorer: ILayoutRestorer,
  editorServices: IEditorServices,
  trackerNotebook: NotebookTracker
): void {
  console.log('JupyterLab extension code-snippets is activated!');
  // const { shell } = app;

  // Get the current widget and activate unless the args specify otherwise.
  // function getCurrent(args: ReadonlyPartialJSONObject): NotebookPanel | null {
  //   const widget = trackerNotebook.currentWidget;
  //   const activate = args['activate'] !== false;

  //   if (activate && widget) {
  //     shell.activateById(widget.id);
  //   }

  //   return widget;
  // }

  const getCurrentWidget = (): Widget => {
    return app.shell.currentWidget;
  };

  const codeSnippetWidget = new CodeSnippetWidget(
    getCurrentWidget,
    app,
    editorServices
  );
  codeSnippetWidget.id = CODE_SNIPPET_EXTENSION_ID;
  codeSnippetWidget.title.icon = codeSnippetIcon;
  codeSnippetWidget.title.caption = 'Code Snippet Explorer';

  const contentsService = CodeSnippetContentsService.getInstance();
  contentsService.save('snippets', { type: 'directory' });

  restorer.add(codeSnippetWidget, CODE_SNIPPET_EXTENSION_ID);

  // Rank has been chosen somewhat arbitrarily to give priority to the running
  // sessions widget in the sidebar.
  app.shell.add(codeSnippetWidget, 'left', { rank: 900 });

  // open code Snippet Editor
  const openCodeSnippetEditor = (args: ICodeSnippetEditorMetadata): void => {
    // codeSnippetEditors are in the main area
    const widgetId = `jp-codeSnippet-editor-${args.id}`;

    const openEditor = find(
      app.shell.widgets('main'),
      (widget: Widget, _: number) => {
        return widget.id === widgetId;
      }
    );
    if (openEditor) {
      app.shell.activateById(widgetId);
      return;
    }

    const codeSnippetEditor = new CodeSnippetEditor(
      contentsService,
      editorServices,
      tracker,
      codeSnippetWidget,
      args
    );

    codeSnippetEditor.id = widgetId;
    codeSnippetEditor.addClass(widgetId);
    codeSnippetEditor.title.label =
      args.name === ''
        ? 'New Code Snippet'
        : '[' + args.language + '] ' + args.name;
    codeSnippetEditor.title.closable = true;
    codeSnippetEditor.title.icon = editorIcon;

    if (!tracker.has(codeSnippetEditor)) {
      tracker.add(codeSnippetEditor);
    }

    if (!codeSnippetEditor.isAttached) {
      app.shell.add(codeSnippetEditor, 'main', {
        mode: 'tab-after'
      });
    }

    // Activate the code Snippet Editor
    app.shell.activateById(codeSnippetEditor.id);
  };

  const editorSaveCommand = 'jp-codeSnippet-editor:save';
  app.commands.addCommand(editorSaveCommand, {
    execute: () => {
      const editor = tracker.currentWidget;
      editor.updateSnippet();
    }
  });

  // Add keybinding to save
  app.commands.addKeyBinding({
    command: editorSaveCommand,
    args: {},
    keys: ['Accel S'],
    selector: '.jp-codeSnippet-editor'
  });

  const editorCommand = 'jp-codeSnippet-editor:open';
  app.commands.addCommand(editorCommand, {
    execute: (args: any) => {
      openCodeSnippetEditor(args);
    }
  });

  //Add an application command
  const saveCommand = 'codeSnippet:save-as-snippet';
  const toggled = false;
  app.commands.addCommand(saveCommand, {
    label: 'Save As Code Snippet',
    isEnabled: () => true,
    isVisible: () => true,
    isToggled: () => toggled,
    iconClass: 'some-css-icon-class',
    execute: () => {
      const highlightedCode = getSelectedText();
      if (highlightedCode === '') {
        //let current = getCurrent(args);
        const curr = document.getElementsByClassName(
          'jp-Cell jp-mod-selected'
        )[1];
        const text = curr as HTMLElement;
        let textContent = text.innerText;
        textContent = textContent.replace(/\uFFFD/g, '');
        const arrayInput = textContent.split('\n');
        const indexedInput = arrayInput.slice(1);
        for (let i = 0; i < indexedInput.length; i++) {
          for (let j = 0; j < indexedInput[i].length; j++) {
            if (indexedInput[i].charCodeAt(j) === 8203) {
              indexedInput[i] = '';
            }
          }
        }
        CodeSnippetInputDialog(codeSnippetWidget, indexedInput, -1);
      } else {
        CodeSnippetInputDialog(
          codeSnippetWidget,
          highlightedCode.split('\n'),
          -1
        );
      }
      // if highlightedCode is empty, check the code of the entire cell.
    }
  });

  // Put the saveCommand above in context menu
  app.contextMenu.addItem({
    command: saveCommand,
    selector: '.jp-Cell'
  });

  // Put the saveCommand in non-notebook file context menu
  app.contextMenu.addItem({
    command: saveCommand,
    selector: '.jp-FileEditor'
  });

  // Track and restore the widget state
  const tracker = new WidgetTracker<CodeSnippetEditor>({
    namespace: 'codeSnippetEditor'
  });

  /**
   * Check the name and go to args. Why does it get restored twice ???
   */
  restorer.restore(tracker, {
    command: editorCommand,
    args: widget => {
      const editorMetadata = widget.codeSnippetEditorMetadata;
      return {
        name: editorMetadata.name,
        description: editorMetadata.description,
        language: editorMetadata.language,
        code: editorMetadata.code,
        id: editorMetadata.id,
        selectedTags: editorMetadata.selectedTags,
        allTags: editorMetadata.allTags
      };
    },
    name: widget => {
      return widget.id;
    }
  });
}

const codeSnippetExtensionSetting: JupyterFrontEndPlugin<void> = {
  id: CODE_SNIPPET_SETTING_ID,
  autoStart: true,
  requires: [ISettingRegistry],
  activate: (app: JupyterFrontEnd, settingRegistry: ISettingRegistry) => {
    void settingRegistry
      .load(CODE_SNIPPET_SETTING_ID)
      .then(_ => console.log('settingRegistry successfully loaded!'))
      .catch(e => console.log(e));
  }
};

function getSelectedText(): string {
  let selectedText;
  // window.getSelection
  if (window.getSelection) {
    selectedText = window.getSelection();
  }
  // document.getSelection
  else if (document.getSelection) {
    selectedText = document.getSelection();
  }
  return selectedText.toString();
}

export default [code_snippet_extension, codeSnippetExtensionSetting];
