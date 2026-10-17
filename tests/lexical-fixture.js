import { createEditor, $getRoot } from 'lexical';
import { registerRichText } from '@lexical/rich-text';
const editor = createEditor({ namespace: 'translate-ai-regression', onError: error => { throw error; } });
registerRichText(editor);
editor.setRootElement(document.querySelector('#lexical'));
editor.registerUpdateListener(({ editorState }) => {
  editorState.read(() => { document.querySelector('#lexical-state').textContent = $getRoot().getTextContent(); });
});
