import { useLoaderData } from "react-router";
import { requireUserId } from "~/lib/auth.server";
import { buildTechStackGraph } from "~/lib/techstack.server";
import { ClientOnly } from "~/components/pdf/ClientOnly";
import { TechStackGraph } from "~/components/techstack/TechStackGraph";
import type { Route } from "./+types/techstack";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  return { data: buildTechStackGraph(userId) };
}

export default function TechStackRoute() {
  const { data } = useLoaderData<typeof loader>();

  if (data.nodes.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium">No tech data yet</p>
        <p className="text-sm mt-1">
          Add a company with a tech stack, or create skill presets in the Library.
        </p>
      </div>
    );
  }

  return (
    <ClientOnly
      fallback={
        <div className="text-gray-500 py-12 text-center">
          Loading graph...
        </div>
      }
    >
      {() => <TechStackGraph data={data} />}
    </ClientOnly>
  );
}
