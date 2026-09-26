import type { Metadata } from "next";

import { TasksView } from "@/components/meetings/TasksView";

export const metadata: Metadata = { title: "Action Items" };

export default function TasksPage() {
  return <TasksView />;
}
