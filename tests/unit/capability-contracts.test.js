'use strict';

const capabilityContracts = require('../../src/governance/capability-contracts');

describe('Capability Contracts', () => {
  describe('getContractForCapability', () => {
    test('githubops.push.propose contract exists with correct constraints', () => {
      const contract = capabilityContracts.getContractForCapability('githubops.push.propose');
      expect(contract).not.toBeNull();
      expect(contract.requires.evaluation).toBe(true);
      expect(contract.requires.executorApproval).toBe(true);
      expect(contract.requires.secretScan).toBe(true);
      expect(contract.restrictions).toContain('proposal_only');
      expect(contract.restrictions).toContain('no_direct_push');
    });

    test('deploy.deploy.propose requires owner', () => {
      const contract = capabilityContracts.getContractForCapability('deploy.deploy.propose');
      expect(contract).not.toBeNull();
      expect(contract.requires.owner).toBe(true);
      expect(contract.restrictions).toContain('no_direct_deploy');
      expect(contract.restrictions).toContain('owner_required');
    });

    test('deploy.rollback.propose is dangerous', () => {
      const contract = capabilityContracts.getContractForCapability('deploy.rollback.propose');
      expect(contract).not.toBeNull();
      expect(contract.actionType).toBe('dangerous');
      expect(contract.requires.owner).toBe(true);
    });

    test('gmail.send is disabled', () => {
      const contract = capabilityContracts.getContractForCapability('gmail.send');
      expect(contract).not.toBeNull();
      expect(contract.enabled).toBe(false);
    });

    test('memory.delete is disabled', () => {
      const contract = capabilityContracts.getContractForCapability('memory.delete');
      expect(contract).not.toBeNull();
      expect(contract.enabled).toBe(false);
    });
  });

  describe('getContractSummary', () => {
    test('returns summary string', () => {
      const summary = capabilityContracts.getContractSummary('githubops.push.propose');
      expect(summary).not.toBeNull();
      expect(summary).toContain('githubops.push');
      expect(summary).toContain('proposal_only');
    });
  });

  describe('getAllContracts', () => {
    test('returns many contracts', () => {
      const all = capabilityContracts.getAllContracts();
      expect(all.length).toBeGreaterThan(40);
    });
  });

  describe('validateContractCompliance', () => {
    test('github push contract is valid', () => {
      const compliance = capabilityContracts.validateContractCompliance('githubops.push.propose');
      expect(compliance.valid).toBe(true);
    });
  });

  describe('RISK_MATRIX', () => {
    test('high risk requires eval and approval', () => {
      expect(capabilityContracts.RISK_MATRIX.high.eval).toBe(true);
      expect(capabilityContracts.RISK_MATRIX.high.approval).toBe(true);
    });

    test('read_only does not require eval', () => {
      expect(capabilityContracts.RISK_MATRIX.read_only.eval).toBe(false);
    });
  });
});
