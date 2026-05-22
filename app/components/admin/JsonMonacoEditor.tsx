import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";

interface JsonMonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  height?: number | string;
  className?: string;
  theme?: "vs-dark" | "light";
  /** Optional JSON Schema for in-editor validation/autocompletion. */
  schema?: {
    uri: string;
    schema: object;
  };
}

let nextModelId = 1;

export default function JsonMonacoEditor({
  value,
  onChange,
  readOnly,
  height = "100%",
  className,
  theme = "vs-dark",
  schema,
}: JsonMonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<monaco.editor.ITextModel | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const modelUri = monaco.Uri.parse(
      `inmemory://abcc/json/${nextModelId++}.json`,
    );
    const model = monaco.editor.createModel(value, "json", modelUri);
    modelRef.current = model;

    const editor = monaco.editor.create(containerRef.current, {
      model,
      theme,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 12,
      lineNumbers: "on",
      tabSize: 2,
      readOnly,
      formatOnPaste: true,
      formatOnType: true,
      scrollBeyondLastLine: false,
      wordWrap: "on",
    });
    editorRef.current = editor;

    const subscription = model.onDidChangeContent(() => {
      onChangeRef.current(model.getValue());
    });

    return () => {
      subscription.dispose();
      editor.dispose();
      model.dispose();
      editorRef.current = null;
      modelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    if (model.getValue() !== value) {
      model.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (editorRef.current) editorRef.current.updateOptions({ readOnly });
  }, [readOnly]);

  useEffect(() => {
    monaco.editor.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    const diagnostics = monaco.json.jsonDefaults.diagnosticsOptions;
    const next = {
      ...diagnostics,
      validate: true,
      allowComments: false,
      schemas: schema
        ? [
            {
              uri: schema.uri,
              fileMatch: [model.uri.toString()],
              schema: schema.schema,
            },
          ]
        : [],
    };
    monaco.json.jsonDefaults.setDiagnosticsOptions(next);
  }, [schema]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width: "100%" }}
    />
  );
}
