import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { resourceService } from "../services/resourceService";
import type { ResourceRecord } from "../utils/types";

// One hook drives list + create + update + delete for any resource endpoint.
export function useResource(endpoint: string, queryKey: string) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: [queryKey],
    queryFn: () => resourceService.list(endpoint),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [queryKey] });

  const create = useMutation({
    mutationFn: (body: ResourceRecord) =>
      resourceService.create(endpoint, body),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number | string; body: ResourceRecord }) =>
      resourceService.update(endpoint, id, body),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number | string) => resourceService.remove(endpoint, id),
    onSuccess: invalidate,
  });

  return { list, create, update, remove };
}
