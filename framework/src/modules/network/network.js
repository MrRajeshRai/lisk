const {
	P2P,
	EVENT_CLOSE_OUTBOUND,
	EVENT_CONNECT_OUTBOUND,
	EVENT_DISCOVERED_PEER,
	EVENT_FAILED_TO_FETCH_PEER_INFO,
	EVENT_FAILED_TO_PUSH_NODE_INFO,
	EVENT_OUTBOUND_SOCKET_ERROR,
	EVENT_INBOUND_SOCKET_ERROR,
	EVENT_UPDATED_PEER_INFO,
	EVENT_FAILED_PEER_INFO_UPDATE,
	EVENT_REQUEST_RECEIVED,
	EVENT_MESSAGE_RECEIVED,
} = require('@liskhq/lisk-p2p');
const { createLoggerComponent } = require('../../components/logger');

/**
 * Network Module
 *
 * @namespace Framework.modules.network
 * @type {module.Network}
 */
module.exports = class Network {
	constructor(options) {
		this.options = options;
		this.channel = null;
		this.logger = null;
	}

	async bootstrap(channel) {
		this.channel = channel;

		const loggerConfig = await this.channel.invoke(
			'lisk:getComponentConfig',
			'logger'
		);

		this.logger = createLoggerComponent(loggerConfig);

		const initialNodeInfo = await this.channel.invoke('chain:getNodeInfo');
		// Receive peer list from the config file and pass it as seed peers in P2P
		const peersFromConfig = this.options.config.peers
			? this.options.config.peers.list
			: [];
		const peersWithIpAddressField = peersFromConfig.map(peer => {
			const { ip, ...peerWithoutIp } = peer;

			return { ipAddress: ip, ...peerWithoutIp };
		});
		// TODO: To be handled in P2P library so that it doesn't try to connect itself
		const removeOwnNode = peersWithIpAddressField.filter(peer => {
			if (
				+this.options.config.wsPort === +peer.wsPort &&
				peer.ipAddress === '127.0.0.1'
			) {
				return false;
			}
			return true;
		});

		const p2pConfig = {
			...this.options,
			nodeInfo: {
				...initialNodeInfo,
				wsPort: this.options.nodeInfo.wsPort,
			},
			seedPeers: removeOwnNode,
		};

		this.p2p = new P2P(p2pConfig);

		this._handleUpdateNodeInfo = event => {
			this.p2p.applyNodeInfo(event.data);
		};

		this.channel.subscribe(
			'chain:system:updateNodeInfo',
			this._handleUpdateNodeInfo
		);

		// ---- START: Bind event handlers ----

		this.p2p.on(EVENT_CLOSE_OUTBOUND, closePacket => {
			this.logger.debug(
				`Outbound connection of peer ${closePacket.peerInfo.ipAddress}:${
					closePacket.peerInfo.wsPort
				} was closed with code ${closePacket.code} and reason: ${
					closePacket.reason
				}`
			);
		});
		this.p2p.on(EVENT_CONNECT_OUTBOUND, peerInfo => {
			this.logger.info(
				`Connected to peer ${peerInfo.ipAddress}:${peerInfo.wsPort}`
			);
		});
		this.p2p.on(EVENT_DISCOVERED_PEER, peerInfo => {
			this.logger.info(
				`Discovered peer ${peerInfo.ipAddress}:${peerInfo.wsPort}`
			);
		});
		this.p2p.on(EVENT_FAILED_TO_FETCH_PEER_INFO, error => {
			this.logger.debug(error.message);
		});
		this.p2p.on(EVENT_FAILED_TO_PUSH_NODE_INFO, error => {
			this.logger.debug(error.message);
		});
		this.p2p.on(EVENT_OUTBOUND_SOCKET_ERROR, error => {
			this.logger.debug(error.message);
		});
		this.p2p.on(EVENT_INBOUND_SOCKET_ERROR, error => {
			this.logger.debug(error.message);
		});
		this.p2p.on(EVENT_UPDATED_PEER_INFO, peerInfo => {
			this.logger.info(
				`Updated info of peer ${peerInfo.ipAddress}:${
					peerInfo.wsPort
				} to ${JSON.stringify(peerInfo)}`
			);
		});
		this.p2p.on(EVENT_FAILED_PEER_INFO_UPDATE, error => {
			this.logger.debug(error.message);
		});

		this.p2p.on(EVENT_REQUEST_RECEIVED, async request => {
			this.logger.info(
				`Received inbound request for procedure ${request.procedure}`
			);
			try {
				const result = await this.channel.invoke(
					request.procedure,
					request.data
				);
				request.end(result); // Send the response back to the peer.
				this.logger.info(`Responsed to peer request ${request.procedure}`);
			} catch (error) {
				request.error(error); // Send an error back to the peer.
				this.logger.debug(
					`Could not respond to peer request ${
						request.procedure
					} because of error: ${error.message}`
				);
			}
		});

		this.p2p.on(EVENT_MESSAGE_RECEIVED, async packet => {
			this.logger.info(`Received inbound message for event ${packet.event}`);
			this.channel.publish(`network:${packet.event}`, packet.data);
		});

		// ---- END: Bind event handlers ----

		try {
			await this.p2p.start();
		} catch (error) {
			this.logger.fatal('Network initialization', {
				message: error.message,
				stack: error.stack,
			});
			process.emit('cleanup', error);
		}
	}

	get actions() {
		return {
			request: async action =>
				this.p2p.request({
					procedure: action.params.procedure,
					data: action.params.data,
				}),
			send: action =>
				this.p2p.send({
					event: action.params.event,
					data: action.params.data,
				}),
			getNetworkStatus: () => {
				const {
					connectedPeers,
					newPeers,
					triedPeers,
				} = this.p2p.getNetworkStatus();

				const uniquerPeersList = [
					...connectedPeers,
					...newPeers,
					...triedPeers,
				].reduce((uniquePeers, peer) => {
					const found = uniquePeers.find(
						findPeer => findPeer.ip === peer.ipAddress
					);

					if (!found) {
						const { ipAddress, ...peerWithoutIp } = peer;

						return [...uniquePeers, { ip: ipAddress, ...peerWithoutIp }];
					}
					return uniquePeers;
				}, []);

				return uniquerPeersList;
			},
			applyPenalty: action => this.p2p.applyPenalty(action.params),
		};
	}

	async cleanup() {
		// TODO: Unsubscribe 'chain:system:updateNodeInfo' from channel.
		return this.p2p.stop();
	}
};
