import Dashboard from "@/components/dashboard";

/**
 * Server shell. Every byte of agent data is read client-side (the chain reads
 * behind /api/agent/* take seconds, and the page must stay interactive while
 * they run), so this component only frames the console.
 */
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Dashboard />
    </div>
  );
}
