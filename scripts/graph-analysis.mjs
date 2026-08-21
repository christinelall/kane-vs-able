function giftsFor(object) {
  if (!object?.gives) return [];
  return Array.isArray(object.gives) ? object.gives : [object.gives];
}

export function analyzeRoom(room) {
  const nodes = [];
  const edges = [];
  const seen = new Map();

  function addNode(id, label, type, icon = "") {
    if (!seen.has(id)) {
      const node = { id, label, type, icon };
      seen.set(id, node);
      nodes.push(node);
    }
  }

  for (const object of room.objects || []) {
    const objectId = `object:${object.id}`;
    addNode(objectId, object.name, "object", object.icon || "◈");

    for (const item of giftsFor(object)) {
      const itemId = `item:${item.id}`;
      addNode(itemId, item.name, "item", item.icon || "◆");
      edges.push({
        from: objectId,
        to: itemId,
        label: "contains",
        kind: "gives",
      });
    }

    if (object.requires) {
      const itemId = `item:${object.requires.id}`;
      addNode(itemId, object.requires.name, "item", "◆");
      edges.push({
        from: itemId,
        to: objectId,
        label: "unlocks",
        kind: "requires",
      });
    }
  }

  addNode("exit", "EXIT", "exit", "🚪");

  if (room.exit?.requires) {
    const itemId = `item:${room.exit.requires.id}`;
    addNode(itemId, room.exit.requires.name, "item", "◆");
    edges.push({
      from: itemId,
      to: "exit",
      label: "unlocks",
      kind: "requires",
    });
  }

  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
  }

  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function dfs(nodeId) {
    if (visiting.has(nodeId)) {
      const start = stack.indexOf(nodeId);
      if (start >= 0) {
        const cycle = [...stack.slice(start), nodeId];
        const signature = [...new Set(cycle)].sort().join("|");
        if (!cycles.some((existing) => existing.signature === signature)) {
          cycles.push({ signature, nodes: cycle });
        }
      }
      return;
    }
    if (visited.has(nodeId)) return;

    visiting.add(nodeId);
    stack.push(nodeId);

    for (const next of adjacency.get(nodeId) || []) {
      dfs(next);
    }

    stack.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const node of nodes) dfs(node.id);

  const cycleNodeIds = [...new Set(cycles.flatMap((cycle) => cycle.nodes))];

  return {
    nodes,
    edges,
    cycles: cycles.map((cycle) => cycle.nodes),
    cycleNodeIds,
    hasCycle: cycles.length > 0,
  };
}
