//@ts-nocheck
import "monaco-editor/esm/vs/editor/browser/coreCommands";
import "monaco-editor/esm/vs/editor/browser/widget/codeEditorWidget";
import "monaco-editor/esm/vs/editor/browser/widget/diffEditorWidget";
import "monaco-editor/esm/vs/editor/browser/widget/diffNavigator";
import "monaco-editor/esm/vs/editor/contrib/anchorSelect/browser/anchorSelect";
import "monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching";
import "monaco-editor/esm/vs/editor/contrib/caretOperations/browser/caretOperations";
import "monaco-editor/esm/vs/editor/contrib/caretOperations/browser/transpose";
import "monaco-editor/esm/vs/editor/contrib/clipboard/browser/clipboard";
import "monaco-editor/esm/vs/editor/contrib/codeAction/browser/codeActionContributions";
import "monaco-editor/esm/vs/editor/contrib/codelens/browser/codelensController";
import "monaco-editor/esm/vs/editor/contrib/colorPicker/browser/colorContributions";
import "monaco-editor/esm/vs/editor/contrib/comment/browser/comment";
import "monaco-editor/esm/vs/editor/contrib/contextmenu/browser/contextmenu";
import "monaco-editor/esm/vs/editor/contrib/cursorUndo/browser/cursorUndo";
import "monaco-editor/esm/vs/editor/contrib/dnd/browser/dnd";
import "monaco-editor/esm/vs/editor/contrib/documentSymbols/browser/documentSymbols";
import "monaco-editor/esm/vs/editor/contrib/find/browser/findController";
import "monaco-editor/esm/vs/editor/contrib/folding/browser/folding";
import "monaco-editor/esm/vs/editor/contrib/fontZoom/browser/fontZoom";
import "monaco-editor/esm/vs/editor/contrib/format/browser/formatActions";
import "monaco-editor/esm/vs/editor/contrib/gotoError/browser/gotoError";
import "monaco-editor/esm/vs/editor/contrib/gotoSymbol/browser/goToCommands";
import "monaco-editor/esm/vs/editor/contrib/gotoSymbol/browser/link/goToDefinitionAtPosition";
import "monaco-editor/esm/vs/editor/contrib/hover/browser/hover";
import "monaco-editor/esm/vs/editor/contrib/inPlaceReplace/browser/inPlaceReplace";
import "monaco-editor/esm/vs/editor/contrib/indentation/browser/indentation";
import "monaco-editor/esm/vs/editor/contrib/inlayHints/browser/inlayHintsController";
import "monaco-editor/esm/vs/editor/contrib/linesOperations/browser/linesOperations";
import "monaco-editor/esm/vs/editor/contrib/linkedEditing/browser/linkedEditing";
import "monaco-editor/esm/vs/editor/contrib/links/browser/links";
import "monaco-editor/esm/vs/editor/contrib/multicursor/browser/multicursor";
import "monaco-editor/esm/vs/editor/contrib/parameterHints/browser/parameterHints";
import "monaco-editor/esm/vs/editor/contrib/rename/browser/rename";
import "monaco-editor/esm/vs/editor/contrib/smartSelect/browser/smartSelect";
import "monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2";
import "monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController";
import "monaco-editor/esm/vs/editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode";
import "monaco-editor/esm/vs/editor/contrib/unusualLineTerminators/browser/unusualLineTerminators";
import "monaco-editor/esm/vs/editor/contrib/viewportSemanticTokens/browser/viewportSemanticTokens";
import "monaco-editor/esm/vs/editor/contrib/wordHighlighter/browser/wordHighlighter";
import "monaco-editor/esm/vs/editor/contrib/wordOperations/browser/wordOperations";
import "monaco-editor/esm/vs/editor/contrib/wordPartOperations/browser/wordPartOperations";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/standalone/browser/accessibilityHelp/accessibilityHelp";
import "monaco-editor/esm/vs/editor/standalone/browser/iPadShowKeyboard/iPadShowKeyboard";
import "monaco-editor/esm/vs/editor/standalone/browser/inspectTokens/inspectTokens";
import "monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess";
import "monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess";
import "monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess";
import "monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneHelpQuickAccess";
import "monaco-editor/esm/vs/editor/standalone/browser/referenceSearch/standaloneReferenceSearch";
import "monaco-editor/esm/vs/editor/standalone/browser/toggleHighContrast/toggleHighContrast";
import React, { useEffect, useMemo, useRef, useState } from "react";

import fake_alloc from "./fake_alloc.rs?raw";
import fake_core from "./fake_core.rs?raw";
import fake_std from "./fake_std.rs?raw";
import { conf, grammar } from "./rust-grammar";

let globalSetup = () => {
  self.MonacoEnvironment = {
    getWorkerUrl: () => "./editor.worker.js",
  };

  monaco.languages.register({
    id: "rust",
  });
  monaco.languages.onLanguage("rust", async () => {
    monaco.languages.setLanguageConfiguration("rust", conf);
    monaco.languages.setMonarchTokensProvider("rust", grammar);
  });
};

globalSetup();

let numRaInsts = 0;

type WorkerProxy = { [method: string]: (...args: any[]) => Promise<any> };
export class RustAnalyzer {
  private constructor(readonly id: string, readonly state: WorkerProxy) {
    monaco.languages.register({ id });

    monaco.languages.onLanguage(id, async () => {
      monaco.languages.setLanguageConfiguration(id, conf);
      monaco.languages.setMonarchTokensProvider(id, grammar);
    });
  }

  static async load() {
    console.debug("Creating Rust Analyzer web worker...");
    let state = await RustAnalyzer.createRA();

    console.debug("Initializing Rust Analyzer...");
    let ra = new RustAnalyzer(`rust-ra-${numRaInsts}`, state);
    numRaInsts += 1;

    ra.registerRA();
    await ra.init();

    console.debug("Rust Analyzer ready!");
    return ra;
  }

  async init() {
    await this.state.init("fn main(){}", fake_std, fake_core, fake_alloc);
  }

  async update(model: monaco.editor.ITextModel) {
    console.debug("Updating Rust Analyzer...");
    const res = await this.state.update(model.getValue());
    monaco.editor.setModelMarkers(model, this.id, res.diagnostics);
  }

  private static async createRA(): Promise<WorkerProxy> {
    const worker = new Worker(new URL("./ra-worker.js", import.meta.url), {
      type: "module",
    });
    const pendingResolve = {};

    let id = 1;
    let ready;

    const callWorker = async (which, ...args) => {
      return new Promise((resolve, _) => {
        pendingResolve[id] = resolve;
        worker.postMessage({
          which: which,
          args: args,
          id: id,
        });
        id += 1;
      });
    };

    const proxyHandler = {
      get: (target, prop, _receiver) => {
        if (prop == "then") {
          return Reflect.get(target, prop, _receiver);
        }
        return async (...args) => {
          return callWorker(prop, ...args);
        };
      },
    };

    worker.onmessage = e => {
      if (e.data.id == "ra-worker-ready") {
        ready(new Proxy({}, proxyHandler));
        return;
      }
      const pending = pendingResolve[e.data.id];
      if (pending) {
        pending(e.data.result);
        delete pendingResolve[e.data.id];
      }
    };

    return new Promise((resolve, _) => {
      ready = resolve;
    });
  }

  private registerRA() {
    let state = this.state;
    monaco.languages.registerHoverProvider(this.id, {
      provideHover: (_, pos) => this.state.hover(pos.lineNumber, pos.column),
    });
    monaco.languages.registerCodeLensProvider(this.id, {
      async provideCodeLenses(m) {
        const code_lenses = await state.code_lenses();
        const lenses = code_lenses.map(({ range, command }) => {
          const position = {
            column: range.startColumn,
            lineNumber: range.startLineNumber,
          };

          const references = command.positions.map(pos => ({
            range: pos,
            uri: m.uri,
          }));
          return {
            range,
            command: {
              id: command.id,
              title: command.title,
              arguments: [m.uri, position, references],
            },
          };
        });

        return { lenses, dispose() {} };
      },
    });
    monaco.languages.registerReferenceProvider(this.id, {
      async provideReferences(m, pos, { includeDeclaration }) {
        const references = await state.references(
          pos.lineNumber,
          pos.column,
          includeDeclaration
        );
        if (references) {
          return references.map(({ range }) => ({ uri: m.uri, range }));
        }
      },
    });
    monaco.languages.registerInlayHintsProvider(this.id, {
      async provideInlayHints(_model, _range, _token) {
        let hints = await state.inlay_hints();
        return hints.map(hint => {
          if (hint.hint_type == 1) {
            return {
              kind: 1,
              position: {
                column: hint.range.endColumn,
                lineNumber: hint.range.endLineNumber,
              },
              text: `: ${hint.label}`,
            };
          }
          if (hint.hint_type == 2) {
            return {
              kind: 2,
              position: {
                column: hint.range.startColumn,
                lineNumber: hint.range.startLineNumber,
              },
              text: `${hint.label}:`,
              whitespaceAfter: true,
            };
          }
        });
      },
    });
    monaco.languages.registerDocumentHighlightProvider(this.id, {
      async provideDocumentHighlights(_, pos) {
        return await state.references(pos.lineNumber, pos.column, true);
      },
    });
    monaco.languages.registerRenameProvider(this.id, {
      async provideRenameEdits(m, pos, newName) {
        const edits = await state.rename(pos.lineNumber, pos.column, newName);
        if (edits) {
          return {
            edits: edits.map(edit => ({
              resource: m.uri,
              edit,
            })),
          };
        }
      },
      async resolveRenameLocation(_, pos) {
        return state.prepare_rename(pos.lineNumber, pos.column);
      },
    });
    monaco.languages.registerCompletionItemProvider(this.id, {
      triggerCharacters: [".", ":", "="],
      async provideCompletionItems(_m, pos) {
        const suggestions = await state.completions(pos.lineNumber, pos.column);
        if (suggestions) {
          return { suggestions };
        }
      },
    });
    monaco.languages.registerSignatureHelpProvider(this.id, {
      signatureHelpTriggerCharacters: ["(", ","],
      async provideSignatureHelp(_m, pos) {
        const value = await state.signature_help(pos.lineNumber, pos.column);
        if (!value) return null;
        return {
          value,
          dispose() {},
        };
      },
    });
    monaco.languages.registerDefinitionProvider(this.id, {
      async provideDefinition(m, pos) {
        const list = await state.definition(pos.lineNumber, pos.column);
        if (list) {
          return list.map(def => ({ ...def, uri: m.uri }));
        }
      },
    });
    monaco.languages.registerTypeDefinitionProvider(this.id, {
      async provideTypeDefinition(m, pos) {
        const list = await state.type_definition(pos.lineNumber, pos.column);
        if (list) {
          return list.map(def => ({ ...def, uri: m.uri }));
        }
      },
    });
    monaco.languages.registerImplementationProvider(this.id, {
      async provideImplementation(m, pos) {
        const list = await state.goto_implementation(
          pos.lineNumber,
          pos.column
        );
        if (list) {
          return list.map(def => ({ ...def, uri: m.uri }));
        }
      },
    });
    monaco.languages.registerDocumentSymbolProvider(this.id, {
      async provideDocumentSymbols() {
        return await state.document_symbols();
      },
    });
    monaco.languages.registerOnTypeFormattingEditProvider(this.id, {
      autoFormatTriggerCharacters: [".", "="],
      async provideOnTypeFormattingEdits(_, pos, ch) {
        return await state.type_formatting(pos.lineNumber, pos.column, ch);
      },
    });
    monaco.languages.registerFoldingRangeProvider(this.id, {
      async provideFoldingRanges() {
        return await state.folding_ranges();
      },
    });
  }
}

let raInstances: { ra: RustAnalyzer; inUse: boolean }[] = [];

export let preloadRaInstances = (n: number): Promise<void> =>
  Promise.all(
    [...Array(n).keys()].map(async () => {
      let ra = await RustAnalyzer.load();
      raInstances.push({ ra, inUse: false });
    })
  );

export let Editor: React.FC<{
  contents: string;
  disabled?: boolean;
  exactHeight?: boolean;
  onChange?: (contents: string) => void;
  onInit?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}> = ({ contents, disabled, exactHeight, onChange, onInit }) => {
  let ref = useRef<HTMLDivElement>(null);
  let model = useMemo(() => monaco.editor.createModel(contents, "rust"), []);
  let [editor, setEditor] = useState<
    monaco.editor.IStandaloneCodeEditor | undefined
  >();

  let [ra, setRa] = useState<RustAnalyzer | undefined>();
  useEffect(() => {
    let inst = raInstances.find(r => !r.inUse);
    if (inst) {
      console.log("Found existing RA instance");
      inst.inUse = true;
      setRa(inst.ra);
      return () => {
        inst.inUse = false;
      };
    } else {
      console.log(
        "Creating new RA instance, new total: ",
        raInstances.length + 1
      );
      let idx;
      RustAnalyzer.load().then(ra => {
        idx = raInstances.length;
        raInstances.push({ ra, inUse: true });
        setRa(ra);
      });
      return () => {
        if (idx === undefined)
          throw new Error("Unmounted editor before RA was loaded");
        raInstances[idx].inUse = false;
      };
    }
  }, []);

  useEffect(() => {
    let editor = monaco.editor.create(ref.current!, {
      model,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      folding: false,
      lineNumbersMinChars: 2,
      fontSize: "14px",
    });
    setEditor(editor);

    let lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
    let lineCount = model.getLineCount();
    let height: number;
    if (exactHeight) {
      height = editor.getTopForLineNumber(lineCount + 1) + lineHeight;
    } else {
      let desiredCount = Math.max(lineCount, 10);
      height = lineHeight * desiredCount;
    }
    ref.current!.style.height = `${height}px`;
    editor.layout();

    let relayout = () => editor.layout();
    window.addEventListener("resize", relayout, false);

    let disposers = [
      () => window.removeEventListener("resize", relayout, false),
    ];

    if (onChange) {
      let dispose = model.onDidChangeContent(() => {
        onChange!(model.getValue());
      });
      disposers.push(dispose.dispose);
    }

    onInit && onInit(editor);

    return () => disposers.forEach(f => f());
  }, []);

  useEffect(() => {
    if (!ra) {
      monaco.editor.setModelLanguage(model, "rust");
      return;
    }

    monaco.editor.setModelLanguage(model, ra.id);
    ra.update(model);
    let dipose = model.onDidChangeContent(() => ra.update(model));

    return dipose.dispose;
  }, [ra]);

  useEffect(() => {
    if (!editor) return;
    editor.updateOptions({ readOnly: disabled });
  }, [disabled, editor]);

  return <div className="editor" ref={ref} />;
};
