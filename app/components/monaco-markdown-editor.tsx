import { useRef, useCallback, useState, useEffect, type ComponentType } from "react";
import type { EditorProps, OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";

interface MonacoMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
}

export function MonacoMarkdownEditor({
  value,
  onChange,
  onSave,
}: MonacoMarkdownEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  });

  const [Editor, setEditor] = useState<ComponentType<EditorProps> | null>(null);

  useEffect(() => {
    import("@monaco-editor/react").then((mod) => {
      setEditor(() => mod.default);
    });
  }, []);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    monaco.editor.defineTheme("cadence-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#0a0a0a",
        "editor.foreground": "#e5e5e5",
        "editorLineNumber.foreground": "#525252",
        "editorLineNumber.activeForeground": "#a3a3a3",
        "editor.selectionBackground": "#262626",
        "editor.lineHighlightBackground": "#171717",
        "editorCursor.foreground": "#e5e5e5",
        "editorWidget.background": "#171717",
        "editorWidget.border": "#262626",
        "input.background": "#171717",
        "input.border": "#262626",
        "focusBorder": "#525252",
      },
    });
    monaco.editor.setTheme("cadence-dark");

    // Register Prettier as Monaco's native document formatter for Markdown
    monaco.languages.registerDocumentFormattingEditProvider("markdown", {
      provideDocumentFormattingEdits: async (model: Monaco.editor.ITextModel) => {
        try {
          const [prettier, markdownPlugin] = await Promise.all([
            import("prettier/standalone"),
            import("prettier/plugins/markdown"),
          ]);
          const formatted = await prettier.format(model.getValue(), {
            parser: "markdown",
            plugins: [markdownPlugin.default],
            proseWrap: "preserve",
            tabWidth: 2,
          });
          return [
            {
              text: formatted,
              range: model.getFullModelRange(),
            },
          ];
        } catch {
          return [];
        }
      },
    });

    // Ctrl+S / Cmd+S to format with Prettier then save
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      async () => {
        const formatAction = editor.getAction(
          "editor.action.formatDocument"
        );
        if (formatAction) {
          await formatAction.run();
          onChangeRef.current(editor.getValue());
        }
        onSaveRef.current?.();
      }
    );
  }, []);

  if (!Editor) {
    return (
      <div
        className="overflow-hidden rounded-md border border-input"
        style={{ height: "500px" }}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-input">
      <Editor
        height="500px"
        defaultLanguage="markdown"
        defaultValue={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          wordWrap: "on",
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          fontSize: 14,
          fontFamily: "ui-monospace, monospace",
          padding: { top: 16, bottom: 16 },
          renderLineHighlight: "line",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          contextmenu: false,
        }}
      />
    </div>
  );
}
