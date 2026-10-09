// The specimens for the fixture app.
//
// `generated` is written by the skill's scripts/specimens.mjs: every component with a call
// site that stands on its own, copied as written. What is left is written by hand here, each
// one still a copy of the real usage named in `from`. Keys are ids from audit.scan.json.
import { Button, Dialog, DialogContent, DialogTitle, Text } from "../components/ui";
import type { AuditSpecimens } from "./AuditPage";
import { generated } from "./specimens.generated";

export const specimens: AuditSpecimens = {
  components: {
    ...generated,
    "src/components/ui/text.tsx#Text": {
      // The source renders `{title}`, which only exists when the app runs.
      from: "src/features/Toolbar.tsx:7",
      mocks: { title: "Campaigns" },
      render: (props) => <Text {...props}>Campaigns</Text>,
    },
    "src/components/ui/dialog.tsx#Dialog": {
      // The usage opens it from a button elsewhere (`open={open}`), so the page adds an Open control.
      from: "src/features/Contacts.tsx:22",
      toggle: "open",
      render: (props) => (
        <Dialog {...props}>
          <DialogContent>
            <DialogTitle>Invite teammates</DialogTitle>
            <Button>Send invite</Button>
          </DialogContent>
        </Dialog>
      ),
    },
    "src/components/ui/dialog.tsx#DialogContent": {
      from: "src/features/Contacts.tsx:23",
      width: 420,
      height: 260,
      scale: 0.5,
      render: (props) => (
        <Dialog open>
          <DialogContent {...props}>
            <DialogTitle>Invite teammates</DialogTitle>
            <Button>Send invite</Button>
          </DialogContent>
        </Dialog>
      ),
    },
  },
  handRolled: {
    "buttons-af2e0cef": {
      from: "src/features/Contacts.tsx:15",
      render: () => <button className="rounded px-3 py-1 raw-danger">Remove</button>,
    },
    "buttons-44f1362e": {
      from: "src/features/Contacts.tsx:18",
      render: () => <button className="raw-link">Dismiss</button>,
    },
    "inputs-810142f8": {
      from: "src/features/Contacts.tsx:21",
      render: () => <input className="raw-input" placeholder="Search contacts" />,
    },
    "modals-c7426f79": {
      from: "src/features/Contacts.tsx:29",
      width: 420,
      height: 260,
      scale: 0.5,
      render: () => (
        <div className="fixed inset-0 raw-backdrop" role="dialog">
          <div className="raw-modal">
            <strong>Delete contact?</strong>
            <button className="raw-danger px-3 py-1 rounded">Delete</button>
          </div>
        </div>
      ),
    },
  },
};
