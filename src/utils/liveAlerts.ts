export interface IdentifiableRow {
  id: string;
}

export const getRowIds = <Row extends IdentifiableRow>(rows: Row[]) => new Set(rows.map((row) => row.id));

export const getAddedRows = <Row extends IdentifiableRow>(knownIds: Set<string> | null, rows: Row[]) => (
  knownIds ? rows.filter((row) => !knownIds.has(row.id)) : []
);
