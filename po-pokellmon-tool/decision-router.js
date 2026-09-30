'use strict';

var fs = require('fs');
var path = require('path');
var contract = require('./decision-contract.js');

function readJson(file) {
    try {
        var value = JSON.parse(fs.readFileSync(file, 'utf8'));
        return value && typeof value === 'object' ? value : {};
    } catch (error) {
        return {};
    }
}

function normalizeAccount(account) {
    return String(account || '').trim().toLowerCase();
}

function loadConfig() {
    var inline = process.env.POKELLMON_DECISION_ROUTING_JSON;
    if (inline) {
        try {
            var parsed = JSON.parse(inline);
            if (parsed && typeof parsed === 'object') return parsed;
        } catch (error) {}
    }
    var file = process.env.POKELLMON_DECISION_ROUTING_FILE ||
        path.join(__dirname, 'decision-routing.json');
    return readJson(file);
}

function resolveProvider(state) {
    var config = loadConfig();
    var account = String(state && state.account || '').trim();
    var accounts = config.accounts && typeof config.accounts === 'object' ? config.accounts : {};
    var provider = accounts[account];
    if (!provider) provider = accounts[normalizeAccount(account)];
    // Account mappings win. providerHint only keeps the old local PS
    // startup mode compatible and never overrides an explicit mapping.
    if (!provider && config.allowClientHint !== false && state && state.providerHint) {
        provider = state.providerHint;
    }
    if (!provider) provider = config.default || process.env.POKELLMON_DEFAULT_DECISION || 'llm';
    provider = String(provider).trim().toLowerCase();
    return provider || 'llm';
}

function randomAction(state) {
    var candidates = contract.getActionCandidates(state || {});
    if (!candidates.length) return null;
    var selected = candidates[Math.floor(Math.random() * candidates.length)];
    return contract.toResponseAction(selected, state && state.platform);
}

module.exports = {
    loadConfig: loadConfig,
    normalizeAccount: normalizeAccount,
    randomAction: randomAction,
    resolveProvider: resolveProvider
};
