// The route an agent writes: the scan, the specimens, and the data, handed to the bundled page.
import "../styles.css";
import { AuditPage, type AuditData, type AuditScan } from "./AuditPage";
import data from "./audit.data.json";
import scan from "./audit.scan.json";
import { specimens } from "./specimens";

export default function Audit() {
  return <AuditPage scan={scan as unknown as AuditScan} specimens={specimens} data={data as AuditData} />;
}
