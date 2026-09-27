import { headers } from "next/headers";
import { Button } from "@cosborn2/ui/button";
import { Input } from "@cosborn2/ui/input";
import { SettingsLayout, SettingsPageHeader, SettingsCard, SettingsCardHeader, SettingsRow, SettingsNavigation } from "@cosborn2/ui/settings";
import "@cosborn2/ui/button.css";
import "@cosborn2/ui/input.css";
import "@cosborn2/ui/settings.css";

export default async function ServerSettingsPage() {
  const requestHeaders = await headers();
  const marker = requestHeaders.get("x-fixture-marker") ?? "server-rendered";
  return (
    <SettingsLayout navigation={<SettingsNavigation active="profile" sections={[{ group: "Account", items: [{ id: "profile", label: "Profile", href: "/", icon: <span aria-hidden="true">P</span> }] }]} />}>
      <SettingsPageHeader title="Server settings fixture" description="Rendered without a library client boundary." />
      <SettingsCard>
        <SettingsCardHeader title="Profile" />
        <SettingsRow label="Display name"><Input id="display-name" aria-label="Display name" defaultValue="Server profile" /></SettingsRow>
        <form action="/">
          <Button type="submit">Server save</Button>
        </form>
        <output data-testid="server-marker">{marker}</output>
        <a href="/interactive">Interactive fixture</a>
      </SettingsCard>
    </SettingsLayout>
  );
}
