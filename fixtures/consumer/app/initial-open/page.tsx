import { DialogExamples } from "../../components/dialog-examples";
import "@cosborn2/ui/button.css";
import "@cosborn2/ui/input.css";
import "@cosborn2/ui/modal.css";
import "@cosborn2/ui/confirm-dialog.css";

export default function InitiallyOpenPage() {
  return <DialogExamples initialOpen><p>Initially open server child</p></DialogExamples>;
}
