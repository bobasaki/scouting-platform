"use client";

import type { ListClientsResponse } from "@scouting-platform/contracts";

type ClientsWorkspaceProps = Readonly<{
  initialData: ListClientsResponse;
}>;

function formatSyncDate(value: string | null | undefined): string {
  if (!value) {
    return "Synced";
  }

  return `Synced ${value.slice(0, 10)}`;
}

export function ClientsWorkspace({ initialData }: ClientsWorkspaceProps) {
  return (
    <div className="clients-workspace">
      <div className="database-records__header">
        <div>
          <h2>Clients</h2>
          <p className="workspace-copy">Browse client records synced from HubSpot.</p>
        </div>
      </div>

      <div className="database-records__table-shell">
        <table className="database-records__table">
          <thead>
            <tr>
              <th>Client name</th>
              <th>Client domain name</th>
              <th>Country/region</th>
              <th>City</th>
              <th>HubSpot</th>
            </tr>
          </thead>
          <tbody>
            {initialData.items.map((client) => (
              <tr key={client.id}>
                <td className="database-records__strong-cell">{client.name}</td>
                <td className="database-records__muted-cell">{client.domain || "-"}</td>
                <td>{client.countryRegion || "-"}</td>
                <td>{client.city || "-"}</td>
                <td className="database-records__muted-cell">
                  {client.hubspotObjectId ? (
                    <span title={client.hubspotObjectType ?? undefined}>
                      {formatSyncDate(client.hubspotSyncedAt)}
                    </span>
                  ) : (
                    "Local"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
