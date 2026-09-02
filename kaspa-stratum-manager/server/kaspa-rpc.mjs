import { fileURLToPath } from "node:url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

const DEFAULT_TIMEOUT_MS = 5_000;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const protoPath = fileURLToPath(new URL("./proto/kaspa-v2.0.1-minimal.proto", import.meta.url));

export class KaspaRpcError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = "KaspaRpcError";
    this.code = code;
  }
}

export const normalizeBlockHash = (value) => {
  const hash = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!HASH_PATTERN.test(hash)) throw new KaspaRpcError("INVALID_BLOCK_HASH", "Block hash must contain exactly 64 hexadecimal characters.");
  return hash;
};

const loadClient = () => {
  const definition = protoLoader.loadSync(protoPath, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: false,
    oneofs: true,
  });
  return grpc.loadPackageDefinition(definition).protowire.RPC;
};

const rpcClient = loadClient();

export class KaspaRpcAdapter {
  constructor({ endpoint, timeoutMs = DEFAULT_TIMEOUT_MS, credentials = grpc.credentials.createInsecure(), clientFactory } = {}) {
    if (!endpoint || typeof endpoint !== "string") throw new KaspaRpcError("INVALID_ENDPOINT", "A local Kaspad gRPC endpoint is required.");
    this.endpoint = endpoint;
    this.timeoutMs = Math.max(250, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);
    this.clientFactory = clientFactory ?? (() => new rpcClient(this.endpoint, credentials));
    this.client = null;
    this.stream = null;
    this.pending = new Map();
    this.nextId = 1n;
  }

  connect() {
    if (this.stream) return;
    this.client ??= this.clientFactory();
    this.stream = this.client.messageStream();
    this.stream.on("data", (message) => this.receive(message));
    this.stream.on("error", (error) => this.disconnectStream(new KaspaRpcError("TRANSPORT_ERROR", `Kaspad RPC stream failed: ${error.message}`, error)));
    this.stream.on("end", () => this.disconnectStream(new KaspaRpcError("TRANSPORT_CLOSED", "Kaspad RPC stream closed.")));
  }

  receive(message) {
    const id = String(message?.id ?? "");
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    clearTimeout(pending.timer);
    const response = message?.[pending.responseName];
    if (!response) return pending.reject(new KaspaRpcError("UNEXPECTED_RESPONSE", `Kaspad returned an unexpected response for request ${id}.`));
    if (response.error?.message) return pending.reject(new KaspaRpcError("RPC_ERROR", response.error.message));
    pending.resolve(response);
  }

  disconnectStream(error) {
    const stream = this.stream;
    this.stream = null;
    if (stream && !stream.destroyed) stream.cancel?.();
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
  }

  call(requestName, responseName, payload = {}) {
    this.connect();
    const id = String(this.nextId++);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new KaspaRpcError("TIMEOUT", `Kaspad did not answer within ${this.timeoutMs} ms.`));
      }, this.timeoutMs);
      this.pending.set(id, { responseName, resolve, reject, timer });
      this.stream.write({ id, [requestName]: payload }, (error) => {
        if (!error) return;
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        clearTimeout(timer);
        reject(new KaspaRpcError("TRANSPORT_ERROR", `Kaspad RPC request failed: ${error.message}`, error));
      });
    });
  }

  async getServerInfo() {
    const response = await this.call("getServerInfoRequest", "getServerInfoResponse");
    return {
      rpcApiVersion: response.rpcApiVersion,
      rpcApiRevision: response.rpcApiRevision,
      serverVersion: response.serverVersion,
      networkId: response.networkId,
      hasUtxoIndex: response.hasUtxoIndex,
      isSynced: response.isSynced,
      virtualDaaScore: response.virtualDaaScore,
    };
  }

  async getBlockRewardInfo(value) {
    const hash = normalizeBlockHash(value);
    const response = await this.call("getBlockRewardInfoRequest", "getBlockRewardInfoResponse", { hash });
    return {
      hash,
      header: response.header ?? null,
      blockColor: String(response.blockColor ?? "UNKNOWN").toLowerCase(),
      confirmationCount: response.confirmationCount ?? null,
      mergingChainBlockHash: response.mergingChainBlockHash?.toLowerCase() ?? null,
      rewardAmountSompi: response.rewardAmount ?? null,
    };
  }

  async getBlock(value, includeTransactions = true) {
    const hash = normalizeBlockHash(value);
    const response = await this.call("getBlockRequest", "getBlockResponse", { hash, includeTransactions });
    return response.block ?? null;
  }

  close() {
    this.disconnectStream(new KaspaRpcError("CLIENT_CLOSED", "Kaspad RPC client closed."));
    this.client?.close?.();
    this.client = null;
  }
}
