import { Notice } from "@cosborn2/ui/notice";
import { Toast } from "@cosborn2/ui/toast";
import "@cosborn2/ui/notice.css";
import "@cosborn2/ui/toast.css";
import { DataTable } from "@cosborn2/ui/data-table";
import { Pagination } from "@cosborn2/ui/pagination";
import "@cosborn2/ui/data-table.css";
import "@cosborn2/ui/pagination.css";

export default async function ServerDataPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = params.page === "1" ? 1 : 0;
  return <main>
    <h1>Server data fixture</h1>
    <Notice heading="Server feedback">Server notice rendered without hydration</Notice>
    <Toast message="Server toast presentation" variant="info" />
    <DataTable caption="Server records" data={[{ id: String(page), name: `Server record ${page + 1}` }]}
      getRowKey={(row) => row.id} columns={[{ key: "name", header: "Record", render: (row) => <strong>{row.name}</strong> }]} />
    <Pagination page={page} total={2} pageSize={1} itemLabel="record" getPageHref={(index) => `/data?page=${index}`} />
  </main>;
}
