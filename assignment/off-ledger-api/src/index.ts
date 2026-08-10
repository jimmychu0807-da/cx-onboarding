import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { botConf, conf } from "./config";
import { Bot } from "./lib/Bot";
import { CantonLedgerApi } from "./lib/CantonLedgerApi";
import { PQSSql } from "./lib/CantonPQS";

const program = new Command();

program
  .name("canton-request")
  .description("CLI to Canton off-ledger request and bot")
  .version("0.1.0");

program
  .command("upload-package")
  .description("Upload a package to a remote canton endpoint")
  .argument("<dar-filepath>", "filepath to the daml package")
  .option(
    "--network",
    "upload the package to all network nodes, specified by NETWORK_ENDPOINTS env",
  )
  .action(async (filePath, opts) => {
    const { ledgerEndpoint, networkEndpoints, useHttps, accessToken } = conf;

    const endpoints = opts?.network ? networkEndpoints : [ledgerEndpoint];

    for (const endpoint of endpoints) {
      const api = new CantonLedgerApi(endpoint, {
        useHttps: useHttps.toUpperCase() === "TRUE",
        accessToken,
      });

      const result = await api.uploadPackage(filePath);
      assert(result);
    }
  });

program
  .command("get-ledger-end")
  .description("Get the latest offset")
  .option(
    "--network",
    "get the ledger-end of the network, specified by NETWORK_ENDPOINTS env",
  )
  .action(async (opts) => {
    const { ledgerEndpoint, networkEndpoints, useHttps, accessToken } = conf;

    const endpoints = opts?.network ? networkEndpoints : [ledgerEndpoint];

    for (const endpoint of endpoints) {
      const api = new CantonLedgerApi(endpoint, {
        useHttps: useHttps.toUpperCase() === "TRUE",
        accessToken,
      });

      const result = await api.getLedgerEnd();

      console.log(`${endpoint}:`, result);
    }
  });

program
  .command("get-update-by-id")
  .description("Get the update by updateID")
  .argument("<update-id", "Update ID")
  .action(async (updateId) => {
    const { ledgerEndpoint, useHttps, accessToken } = conf;

    const api = new CantonLedgerApi(ledgerEndpoint, {
      useHttps: useHttps.toUpperCase() === "TRUE",
      accessToken,
    });

    const result = await api.getUpdateById(updateId);
    console.dir(result, { depth: null, colors: true });
  });

program
  .command("get-authenticated-user")
  .description("Get authenticated user of the provided access token")
  .action(async () => {
    const { ledgerEndpoint, useHttps, accessToken } = conf;

    const api = new CantonLedgerApi(ledgerEndpoint, {
      useHttps: useHttps.toUpperCase() === "TRUE",
      accessToken,
    });

    const result = await api.getAuthenticatedUser();
    console.log(result);
  });

program
  .command("get-user-rights")
  .description("Get the user rights for the particular user ID")
  .argument("<user-id>", "User ID")
  .action(async (userId) => {
    const { ledgerEndpoint, useHttps, accessToken } = conf;

    const api = new CantonLedgerApi(ledgerEndpoint, {
      useHttps: useHttps.toUpperCase() === "TRUE",
      accessToken,
    });

    const result = await api.getUserRights(userId);
    console.log(result);
  });

program
  .command("set-user-rights")
  .description("Set the user rights for the particular user ID")
  .argument("<user-id>", "User ID")
  .argument("<user-right-path>", "Path to user rights object")
  .action(async (userId, inputFilePath) => {
    const { ledgerEndpoint, useHttps, accessToken } = conf;
    const inputFile = await readFile(inputFilePath, "utf8");
    const rightsObj = JSON.parse(inputFile);

    const api = new CantonLedgerApi(ledgerEndpoint, {
      useHttps: useHttps.toUpperCase() === "TRUE",
      accessToken,
    });

    await api.setUserRights(userId, rightsObj);
  });

program
  .command("list-participant-id")
  .description("List participant ID")
  .option(
    "--network",
    "list participant IDs of the network, specified by NETWORK_ENDPOINTS env",
  )
  .action(async (opts) => {
    const { ledgerEndpoint, networkEndpoints, useHttps, accessToken } = conf;

    const endpoints = opts?.network ? networkEndpoints : [ledgerEndpoint];

    for (const endpoint of endpoints) {
      const api = new CantonLedgerApi(endpoint, {
        useHttps: useHttps.toUpperCase() === "TRUE",
        accessToken,
      });

      const result = await api.getParticipantId();
      console.log(`${endpoint}:`, result);
    }
  });

program
  .command("list-packages")
  .description("List all package info of a remote canton endpoint")
  .option("-p, --package <string>", "package name filter")
  .option("--pid <string>", "participantId")
  .action(async (opts) => {
    const { ledgerEndpoint, useHttps, accessToken } = conf;

    const api = new CantonLedgerApi(ledgerEndpoint, {
      useHttps: useHttps.toUpperCase() === "TRUE",
      accessToken,
    });

    const result = await api.getPackagesWithVettedInfo(opts.package, opts.pid);
    console.log("result:", result);
  });

program
  .command("submit-cmds")
  .description("Submit commands to the ledger API")
  .argument("<input-file>", "input command JSON filepath")
  .action(async (inputFilePath) => {
    const { ledgerEndpoint, useHttps, accessToken } = conf;

    const api = new CantonLedgerApi(ledgerEndpoint, {
      useHttps: useHttps.toUpperCase() === "TRUE",
      accessToken,
    });

    const inputFile = await readFile(inputFilePath, "utf8");
    const cmdsObj = JSON.parse(inputFile);

    await api.submitCmds(cmdsObj);
  });

program
  .command("pqs-active")
  .description("Get active contracts")
  .argument("[template]", "template name in fqn postfix form")
  .action(async (templateName?: string) => {
    const rows = await PQSSql`
      SELECT template_fqn, payload_type, contract_id, life_ix, payload
      FROM active(${templateName})
    `;
    console.log(rows);
  });

program
  .command("pqs-creates")
  .description("Get contracts ever created")
  .argument("[template]", "template name in fqn postfix form")
  .action(async (templateName?: string) => {
    const rows = await PQSSql`
      SELECT template_fqn, payload_type, contract_id, created_at_offset, archived_at_offset, payload
      FROM creates(${templateName})
    `;
    console.log(rows);
  });

program
  .command("pqs-lookup-contract")
  .description("Get contract information")
  .argument("<contract-id>", "The contract ID to retrieve")
  .action(async (contractId: string) => {
    const res = await PQSSql`
      SELECT template_fqn, payload_type, contract_id, created_at_offset, archived_at_offset, payload
      FROM lookup_contract(${contractId})
    `;
    console.log(res);
  });

program
  .command("pqs-lookup-exercises")
  .description("Get contract information")
  .argument("<contract-id>", "The contract ID to retrieve")
  .action(async (contractId: string) => {
    const res = await PQSSql`
      SELECT template_fqn, choice_fqn, consuming, exercised_at_offset, contract_id, result
      FROM lookup_exercises(${contractId})
    `;
    console.log(res);
  });

program
  .command("bot")
  .description(
    "bot that listen to a specific template and send an exercise choice correspondingly.",
  )
  .option("-p, --polling <value>", "polling time in seconds", "5")
  .option("-o, --offset [number]", "offset to listen from", "0")
  .option("--partyId <value>", "PartyID and fingerprint")
  .option("--templateId <value>", "Template ID to listen to")
  .action(async (opts) => {
    // Bot use another set of config
    const {
      ledgerEndpoint,
      useHttps,
      accessToken,
      listeningTemplateId,
      listeningPartyId,
    } = botConf;

    const api = new CantonLedgerApi(ledgerEndpoint, {
      useHttps: useHttps.toUpperCase() === "TRUE",
      accessToken,
    });

    await Bot.execute(api, {
      polling: Number(opts.polling),
      offset: Number(opts.offset),
      partyId: opts.partyId ?? listeningPartyId,
      templateId: opts.templateId ?? listeningTemplateId,
    });
  });

await program.parseAsync(process.argv);
