import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import MentionList from "./mentions-list";

const suggestion = {
  items: ({ query }: { query: string }) => {
    return [
      { id: "firstName", label: "First Name" },
      { id: "lastName", label: "Last Name" },
      { id: "email", label: "Email" },
    ].filter((item) =>
      item.label.toLowerCase().startsWith(query.toLowerCase())
    );
  },

  render: () => {
    let component: any;
    let popup: any;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },

      onUpdate(props: any) {
        component.updateProps(props);

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: any) {
        if (props.event.key === "Escape") {
          popup[0].hide();
          return true;
        }

        return component.ref?.onKeyDown(props);
      },

      onExit() {
        popup[0].destroy();
        component.destroy();
      },
    };
  },
};

export default suggestion;
