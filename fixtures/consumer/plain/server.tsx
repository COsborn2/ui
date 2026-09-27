import { Notice } from "@cosborn2/ui/notice";
import { ToastExamples } from "../components/toast-examples";
import { ActionsMenuExamples } from "../components/actions-menu-examples";
import { CompositionExamples } from "../components/composition-examples";
import { renderToString } from "react-dom/server";
import { ControlExamples } from "../components/control-examples";
import { DialogExamples } from "../components/dialog-examples";

const initialOpen = process.argv.includes("--initial-open");
const content = renderToString(<><DialogExamples initialOpen={initialOpen} /><ControlExamples /><CompositionExamples /><Notice heading="Shared feedback">Plain React notice without Tailwind</Notice><ToastExamples /><ActionsMenuExamples /></>);
console.log(`<!doctype html><html lang="en" data-bnh-theme="dark"><head><meta charset="utf-8"><title>Plain React package fixture</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/client.css"></head><body><div id="fixture-root" data-initial-open="${initialOpen}">${content}</div><script type="module" src="/client.js"></script></body></html>`);
