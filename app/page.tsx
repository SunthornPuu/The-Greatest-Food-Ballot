import { TheCount } from "@/components/ranking/TheCount";
import { loadCountData } from "@/lib/count-data";

// Always render fresh numbers; realtime takes over in the browser.
export const dynamic = "force-dynamic";

export default async function Home() {
  return <TheCount initial={await loadCountData()} />;
}
