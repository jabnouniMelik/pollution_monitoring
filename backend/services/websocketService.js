/**
 * WebSocket Service for Real-Time KPI Data Streaming
 * Handles bi-directional communication with frontend for live KPI updates
 */

const WebSocket = require("ws");

let wsServer = null;
let clients = new Map(); // Map<clientId, {ws, userId, role, subscribedTopics}>

/**
 * Initialize WebSocket Server
 * @param {http.Server} server - Express HTTP server instance
 * @returns {ws.Server}
 */
function initializeWebSocket(server) {
  wsServer = new WebSocket.Server({ server, path: "/ws" });

  wsServer.on("connection", (ws, req) => {
    const clientId = generateClientId();
    const clientIp = req.socket.remoteAddress;

    console.log(`[WebSocket] Client connected: ${clientId} from ${clientIp}`);

    // Store client connection
    clients.set(clientId, {
      ws,
      userId: null,
      role: null,
      subscribedTopics: new Set(),
      connectedAt: new Date(),
    });

    // ── Message Handler ─────────────────────────────
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        handleClientMessage(clientId, data);
      } catch (err) {
        console.error(
          `[WebSocket] Error parsing message from ${clientId}:`,
          err.message
        );
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid message format",
          })
        );
      }
    });

    // ── Close Handler ────────────────────────────────
    ws.on("close", () => {
      console.log(`[WebSocket] Client disconnected: ${clientId}`);
      clients.delete(clientId);
    });

    // ── Error Handler ────────────────────────────────
    ws.on("error", (err) => {
      console.error(`[WebSocket] Error for client ${clientId}:`, err.message);
      clients.delete(clientId);
    });

    // Send connection confirmation
    ws.send(
      JSON.stringify({
        type: "connected",
        clientId,
        message: "WebSocket connection established",
      })
    );
  });

  return wsServer;
}

/**
 * Handle incoming messages from clients
 */
function handleClientMessage(clientId, data) {
  const { type, payload } = data;
  const client = clients.get(clientId);

  if (!client) {
    console.warn(`[WebSocket] Client ${clientId} not found`);
    return;
  }

  switch (type) {
    case "authenticate":
      // Client sends userId and role for authentication
      handleAuthentication(clientId, payload);
      break;

    case "subscribe":
      // Client subscribes to KPI topics (e.g., "kpi:daily", "kpi:hourly")
      handleSubscription(clientId, payload);
      break;

    case "unsubscribe":
      // Client unsubscribes from topics
      handleUnsubscription(clientId, payload);
      break;

    case "ping":
      // Heartbeat to keep connection alive
      client.ws.send(JSON.stringify({ type: "pong" }));
      break;

    default:
      console.warn(`[WebSocket] Unknown message type: ${type}`);
  }
}

/**
 * Authenticate WebSocket connection with userId and role
 */
function handleAuthentication(clientId, payload) {
  const { userId, role, email } = payload;
  const client = clients.get(clientId);

  if (!client) return;

  client.userId = userId;
  client.role = role;
  client.email = email;

  console.log(
    `[WebSocket] Client ${clientId} authenticated as ${role} (${email})`
  );

  client.ws.send(
    JSON.stringify({
      type: "authenticated",
      message: `Authenticated as ${role}`,
      userId,
      role,
    })
  );
}

/**
 * Handle topic subscription
 */
function handleSubscription(clientId, payload) {
  const { topics } = payload; // topics = ["kpi:daily", "kpi:hourly", ...]
  const client = clients.get(clientId);

  if (!client) return;

  if (!Array.isArray(topics)) {
    client.ws.send(
      JSON.stringify({
        type: "error",
        message: "Topics must be an array",
      })
    );
    return;
  }

  topics.forEach((topic) => {
    client.subscribedTopics.add(topic);
  });

  console.log(
    `[WebSocket] Client ${clientId} subscribed to: ${Array.from(client.subscribedTopics).join(", ")}`
  );

  client.ws.send(
    JSON.stringify({
      type: "subscribed",
      topics,
      message: `Subscribed to ${topics.length} topic(s)`,
    })
  );
}

/**
 * Handle topic unsubscription
 */
function handleUnsubscription(clientId, payload) {
  const { topics } = payload;
  const client = clients.get(clientId);

  if (!client) return;

  if (!Array.isArray(topics)) {
    client.ws.send(
      JSON.stringify({
        type: "error",
        message: "Topics must be an array",
      })
    );
    return;
  }

  topics.forEach((topic) => {
    client.subscribedTopics.delete(topic);
  });

  console.log(
    `[WebSocket] Client ${clientId} unsubscribed from: ${topics.join(", ")}`
  );

  client.ws.send(
    JSON.stringify({
      type: "unsubscribed",
      topics,
      message: `Unsubscribed from ${topics.length} topic(s)`,
    })
  );
}

/**
 * Broadcast KPI data to all subscribed clients
 * @param {string} topic - Topic name (e.g., "kpi:daily", "kpi:hourly")
 * @param {object} data - KPI data to broadcast
 */
function broadcastKPIUpdate(topic, data) {
  if (!wsServer) {
    console.warn(
      "[WebSocket] Server not initialized, cannot broadcast KPI update"
    );
    return;
  }

  let messageCount = 0;

  clients.forEach((client, clientId) => {
    if (client.subscribedTopics.has(topic)) {
      try {
        client.ws.send(
          JSON.stringify({
            type: "kpi_update",
            topic,
            timestamp: new Date().toISOString(),
            data,
          })
        );
        messageCount++;
      } catch (err) {
        console.error(
          `[WebSocket] Error sending to client ${clientId}:`,
          err.message
        );
      }
    }
  });

  if (messageCount > 0) {
    console.log(
      `[WebSocket] Broadcasted KPI update on '${topic}' to ${messageCount} client(s)`
    );
  }
}

/**
 * Send alert to all clients with appropriate role
 * @param {object} alert - Alert data
 * @param {string[]} allowedRoles - Roles that can see this alert
 */
function broadcastAlert(alert, allowedRoles = ["SUPER_ADMIN", "HEAD_SUPERVISOR"]) {
  if (!wsServer) return;

  let messageCount = 0;

  clients.forEach((client, clientId) => {
    if (allowedRoles.includes(client.role)) {
      try {
        client.ws.send(
          JSON.stringify({
            type: "alert",
            timestamp: new Date().toISOString(),
            alert,
          })
        );
        messageCount++;
      } catch (err) {
        console.error(
          `[WebSocket] Error sending alert to client ${clientId}:`,
          err.message
        );
      }
    }
  });

  if (messageCount > 0) {
    console.log(
      `[WebSocket] Broadcasted alert to ${messageCount} authorized client(s)`
    );
  }
}

/**
 * Send message to specific user
 */
function sendToUser(userId, message) {
  if (!wsServer) return;

  let sent = false;
  clients.forEach((client, clientId) => {
    if (client.userId === userId) {
      try {
        client.ws.send(JSON.stringify(message));
        sent = true;
      } catch (err) {
        console.error(
          `[WebSocket] Error sending to user ${userId}:`,
          err.message
        );
      }
    }
  });

  return sent;
}

/**
 * Get WebSocket server statistics
 */
function getStats() {
  return {
    totalConnections: clients.size,
    connections: Array.from(clients.entries()).map(([clientId, client]) => ({
      clientId,
      userId: client.userId,
      role: client.role,
      email: client.email,
      connectedAt: client.connectedAt,
      subscribedTopics: Array.from(client.subscribedTopics),
    })),
  };
}

/**
 * Generate unique client ID
 */
function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  initializeWebSocket,
  broadcastKPIUpdate,
  broadcastAlert,
  sendToUser,
  getStats,
  handleClientMessage,
};
