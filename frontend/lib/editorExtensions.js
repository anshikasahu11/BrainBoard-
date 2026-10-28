import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";

// The one place that decides what the editor can do. The writing editor and the
// read-only history viewer both use it, so they can never disagree about what a
// document may contain. It matches what the server accepts: headings 1 to 3, lists,
// checklists, quotes, code, and web or email links.
export function createEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
  ];
}