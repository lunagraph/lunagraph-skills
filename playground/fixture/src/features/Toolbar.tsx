import { IconButton } from "../components/IconButton";
import { Badge, Button, Text } from "@/components/ui";

export function Toolbar({ title, saving, onSave }: { title: string; saving: boolean; onSave: () => void }) {
  return (
    <div className="toolbar">
      <Text size="lg">{title}</Text>
      <Badge tone="success">Live</Badge>
      <Button onClick={onSave} loading={saving}>
        Save
      </Button>
      <Button variant="outline" size="sm">
        Cancel
      </Button>
      <Button variant={saving ? "ghost" : "outline"}>Preview</Button>
      <Button variant="outline" className="rounded-full shadow-lg">
        Share
      </Button>
      <Button className="ml-2">Export</Button>
      <IconButton aria-label="Add">+</IconButton>
      <IconButton aria-label="Remove" active>
        -
      </IconButton>
      <button className="raw-danger px-3 py-1 rounded" onClick={onSave}>
        Delete
      </button>
    </div>
  );
}
