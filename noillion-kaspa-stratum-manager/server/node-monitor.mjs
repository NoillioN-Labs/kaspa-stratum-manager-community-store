// Read-only external Kaspad observer. Node data is bounded and never persisted.
export class NodeMonitor {
  constructor(rpc) {
    this.rpc = rpc;
    this.blocks = new Map();
    this.info = null;
    this.error = null;
    this.connected = false;
    this.subscribed = false;
    this.running = false;
    this.timer = null;
    this.checkedAt = null;
    this.generation = 0;
    rpc?.on?.("offline", () => {
      this.generation++;
      this.connected = false;
      this.subscribed = false;
      this.error = "Node disconnected; retrying";
    });
    rpc?.on?.("block", (block) => this.add(block));
    rpc?.on?.("chain", (change) => {
      for (const hash of change.removedChainBlockHashes ?? []) {
        const b = this.blocks.get(hash);
        if (b) b.chain = false;
      }
      for (const hash of change.addedChainBlockHashes ?? []) {
        const b = this.blocks.get(hash);
        if (b) {
          b.chain = true;
          b.color = "blue";
        }
      }
    });
  }
  add(block) {
    const hash = block?.verboseData?.hash ?? block?.header?.hash;
    if (!/^[a-f0-9]{64}$/i.test(hash ?? "")) return null;
    const existing = this.blocks.get(hash);
    const b = {
      hash,
      parents: block.header?.parents?.[0]?.parentHashes ?? [],
      daaScore: block.header?.daaScore ?? null,
      blueScore: block.header?.blueScore ?? null,
      timestamp: block.header?.timestamp ?? null,
      color: existing?.color ?? "unknown",
      chain: block.verboseData?.isChainBlock ?? existing?.chain ?? false,
    };
    if (b.chain) b.color = "blue";
    this.blocks.set(hash, b);
    for (const [field, color] of [
      ["mergeSetBluesHashes", "blue"],
      ["mergeSetRedsHashes", "red"],
    ])
      for (const h of block.verboseData?.[field] ?? []) {
        const known = this.blocks.get(h);
        if (known) known.color = color;
      }
    while (this.blocks.size > 160)
      this.blocks.delete(this.blocks.keys().next().value);
    return b;
  }
  async expand(hash) {
    return this.add(await this.rpc.getBlock(hash, false));
  }
  async tick() {
    if (!this.rpc?.call) return;
    const generation = this.generation;
    try {
      if (!this.subscribed) {
        await this.rpc.call(
          "notifyBlockAddedRequest",
          "notifyBlockAddedResponse",
          { command: "NOTIFY_START" },
        );
        await this.rpc.call(
          "notifyVirtualChainChangedRequest",
          "notifyVirtualChainChangedResponse",
          { command: "NOTIFY_START", includeAcceptedTransactionIds: false },
        );
        if (generation !== this.generation) return;
        this.subscribed = true;
        this.blocks.clear();
      }
      const [server, dag, peers] = await Promise.all([
        this.rpc.getServerInfo(),
        this.rpc.call("getBlockDagInfoRequest", "getBlockDagInfoResponse"),
        this.rpc.call(
          "getConnectedPeerInfoRequest",
          "getConnectedPeerInfoResponse",
        ),
      ]);
      if (generation !== this.generation) return;
      this.info = {
        ...server,
        blockCount: dag.blockCount ?? null,
        headerCount: dag.headerCount ?? null,
        difficulty: dag.difficulty ?? null,
        peerCount: peers.infos?.length ?? 0,
        tipCount: dag.tipHashes?.length ?? 0,
      };
      this.connected = true;
      this.error = null;
      this.checkedAt = new Date().toISOString();
      if (!this.blocks.size)
        await Promise.allSettled(
          (dag.tipHashes ?? []).slice(0, 4).map((hash) => this.expand(hash)),
        );
    } catch (error) {
      this.connected = false;
      this.error = error.message;
    }
  }
  start() {
    if (this.running) return;
    this.running = true;
    const loop = async () => {
      await this.tick();
      if (this.running) {
        this.timer = setTimeout(loop, 10_000);
        this.timer.unref?.();
      }
    };
    void loop();
  }
  stop() {
    this.running = false;
    clearTimeout(this.timer);
  }
  snapshot() {
    return {
      enabled: Boolean(this.rpc),
      connected: this.connected,
      checkedAt: this.checkedAt,
      error: this.error,
      info: this.info,
      blocks: [...this.blocks.values()],
    };
  }
}
