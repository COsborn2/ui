import type { Preview } from "@storybook/react-vite";
import "../dist/styles/all.css";
import "./preview.css";

const preview: Preview = {
  tags: ["autodocs"],
  initialGlobals: { theme: "dark" },
  globalTypes: {
    theme: {
      description: "Component color theme",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [{ value: "dark", title: "Dark" }, { value: "light", title: "Light" }],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: "padded",
    controls: { expanded: true },
    a11y: { test: "error" },
  },
  decorators: [(Story, context) => {
    const Container = context.parameters.hasMainLandmark ? "div" : "main";
    return <Container data-bnh-theme={context.globals.theme} className="story-surface"><Story /></Container>;
  }],
};

export default preview;
