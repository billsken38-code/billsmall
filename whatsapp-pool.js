// WhatsApp Support Pool System
// Automatically assigns customers to available support agents

const WHATSAPP_POOL = {
  // Add your WhatsApp numbers here (include country code, no + or dashes)
  // Format: { phone: "233501234567", name: "Agent Name" }
  agents: [
    { phone: "233599480662", name: "Customer Support" },
    { phone: "233200650019", name: "Sales Support" },
    { phone: "233501234569", name: "Order Support" }
  ],

  // Get a random agent from the pool
  getRandomAgent() {
    const index = Math.floor(Math.random() * this.agents.length);
    return this.agents[index];
  },

  // Generate WhatsApp chat URL
  getChatUrl(message = "") {
    const agent = this.getRandomAgent();
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${agent.phone}?text=${encodedMessage}`;
  },

  // Generate chat URL with specific agent
  getChatUrlWithAgent(agentIndex, message = "") {
    if (agentIndex < 0 || agentIndex >= this.agents.length) {
      return this.getChatUrl(message);
    }
    const agent = this.agents[agentIndex];
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${agent.phone}?text=${encodedMessage}`;
  }
};

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = { WHATSAPP_POOL };
}