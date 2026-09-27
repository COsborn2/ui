import "@cosborn2/ui/toast.css";
import { ToastExamples } from "../../components/toast-examples";
import "@cosborn2/ui/actions-menu.css";
import { ActionsMenuExamples } from "../../components/actions-menu-examples";
import { CompositionExamples } from "../../components/composition-examples";
import { ControlExamples } from "../../components/control-examples";
import { DialogExamples } from "../../components/dialog-examples";
import "@cosborn2/ui/button.css";
import "@cosborn2/ui/input.css";
import "@cosborn2/ui/modal.css";
import "@cosborn2/ui/confirm-dialog.css";
import "@cosborn2/ui/data-table.css";
import "@cosborn2/ui/pagination.css";
import "@cosborn2/ui/theme-toggle.css";
import "@cosborn2/ui/color-picker.css";
import "@cosborn2/ui/header-shell.css";
import "@cosborn2/ui/expandable-pill.css";

export default async function InteractivePage() {
  const serverValue = await Promise.resolve("Computed on the server");
  return <><DialogExamples><section data-testid="server-child">{serverValue}</section></DialogExamples><ControlExamples /><CompositionExamples /><ToastExamples /><ActionsMenuExamples /></>;
}
