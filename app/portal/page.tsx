import { requireChatGPTUser } from "@/app/chatgpt-auth";
import Portal from "./portal";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const user = await requireChatGPTUser("/portal");
  return <Portal initialUser={{ displayName: user.displayName, email: user.email }} />;
}
