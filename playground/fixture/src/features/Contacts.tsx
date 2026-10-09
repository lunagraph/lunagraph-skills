import { useState } from "react";
import { Badge, Button, Dialog, DialogContent, DialogTitle, Text } from "@/components/ui";

export default function Contacts() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <section>
      <Text muted>3 contacts</Text>
      <Badge>Draft</Badge>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Invite
      </Button>
      {/* The same look as the raw button in Toolbar.tsx: one cluster, two locations. */}
      <button className="rounded px-3 py-1 raw-danger" onClick={() => setConfirming(true)}>
        Remove
      </button>
      <button className="raw-link" onClick={() => setOpen(false)}>
        Dismiss
      </button>
      <input className="raw-input" placeholder="Search contacts" />
      <Dialog open={open}>
        <DialogContent>
          <DialogTitle>Invite teammates</DialogTitle>
          <Button>Send invite</Button>
        </DialogContent>
      </Dialog>
      {confirming ? (
        <div className="fixed inset-0 raw-backdrop" role="dialog">
          <div className="raw-modal">
            <strong>Delete contact?</strong>
            <button className="raw-danger px-3 py-1 rounded">Delete</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
