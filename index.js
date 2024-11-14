const core = require('@actions/core')
const github = require('@actions/github')
const path = require('path')
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');

run().catch(e => {
    console.log(e)
    core.setFailed(e.message || e);
});

async function run() {
    core.info(`Inigo GraphQL started`);

    const token = process.env.GITHUB_TOKEN;
    const octokit = github.getOctokit(token);

    const head_sha = github.context.payload.pull_request
        // on "pull_request"
        ? github.context.payload.pull_request.head.sha
        // on "push"
        : github.context.sha

    const check = await octokit.rest.checks.create({
        ...github.context.repo,
        name: "Inigo GraphQL",
        status: 'in_progress',
        head_sha: head_sha
    });

    const checkId = check.data.id;
    core.info(`Check ID: ${checkId}`);

    // run inigo_cli command
    const configs = path.resolve(process.env.GITHUB_WORKSPACE, process.env.INIGO_CONFIG_PATH);
    const cli = process.env.INIGO_CLI
    const action = process.env.INIGO_ACTION
    let cmd = `${cli} ${action} ${configs} --export-to=./output.json`

    const label = process.env.INIGO_SERVICE_LABEL
    if (label !== "") {
        cmd += ` --label ${label}`
    }

    try {
        const output = await exec(cmd);
        if (output.stdout) {
            core.info(output.stdout)
        }
        if (output.stderr) {
            core.info(output.stderr)
        }
        core.info(`no issues found`)
    } catch(output) {
        if (output.stdout) {
            core.info(output.stdout)
        }
        if (output.stderr) {
            core.info(output.stderr)
        }
        if (output.code === 1) {
            core.setFailed(`Inigo GraphQL failed.`)
        } else {
            core.setFailed(`Inigo GraphQL exit with code ${output.code}`)
        }
    }

    // read exported json data
    let data;
    try {
        const content = fs.readFileSync('./output.json', 'utf8');
        data = JSON.parse(content)
    } catch (err) {
        core.setFailed(err)
        return
    }

    // collect annotations
    let conclusion = "success"
    const annotations = []
    for (let i = 0; i < (data || []).length; i++) {
        // fail the check if at least one report failed
        if (data[i].Status === 'failed') {
            conclusion = 'failure'
        }

        // composition errors
        for (const c of (data[i].CompositionErrors || [])) {
            if (c.Locations?.length === 0) { continue }
            annotations.push(schemaErrorToAnnotation("Composition", "failure", configs, c))
        }

        // operational check errors
        for (const c of (data[i].OperationalCheckReport?.Changes || [])) {
            if (c.Level === "info" || c.Level === "debug") { continue }
            annotations.push({
                annotation_level: levelToAnnotationLevel(c.Level),
                title: "Operational Check",
                message: c.Description,
                path: formatSchemaFilePath(configs, c.Location?.File),
                start_line: c.Location?.Line,
                end_line: c.Location?.Line,
            })
        }

        // linting errors
        for (const c of (data[i].SchemaLintReport?.Errors || [])) {
            if (c.Locations?.length === 0) { continue }
            annotations.push(schemaErrorToAnnotation("Linter", "failure", configs, c))
        }
        for (const c of (data[i].SchemaLintReport?.Warnings || [])) {
            if (c.Locations?.length === 0) { continue }
            annotations.push(schemaErrorToAnnotation("Linter", "warning", configs, c))
        }
        for (const c of (data[i].SchemaLintReport?.Infos || [])) {
            if (c.Locations?.length === 0) { continue }
            annotations.push(schemaErrorToAnnotation("Linter", "notice", configs, c))
        }
    }

    core.info(`Result: ${conclusion}.`);

    core.info(`Updating check: ${checkId}.`);
    await octokit.rest.checks.update({
        check_run_id: checkId,
        completed_at: new Date().toISOString(),
        status: 'completed',
        ...github.context.repo,
        conclusion,
        output: {
            title: "Inigo GraphQL completed",
            summary: "Inigo GraphQL completed",
        },
    });

    core.info(`Annotations to be attached: ${annotations.length}.`);
    try {
        await octokit.rest.checks.update({
            check_run_id: checkId,
            ...github.context.repo,
            output: {
                title: "Inigo GraphQL completed",
                summary: "Inigo GraphQL completed",
                annotations
            },
        });
    } catch (error) {
        core.error(`failed to send annotations: ${error}`);
        throw error;
    }

    if (conclusion === "failure") {
        return core.setFailed("Inigo GraphQL");
    }
}

function schemaErrorToAnnotation(title, level, configsPath, c) {
    return {
        title: title,
        annotation_level: level,
        message: c.Message,
        path: formatSchemaFilePath(configsPath, c.Locations[0]?.File),
        start_line: c.Locations[0]?.Line,
        end_line: c.Locations[0]?.Line,
    }
}

function formatSchemaFilePath(basepath, schemapath) {
    return path.
        resolve(path.dirname(basepath), schemapath).
        replace(`${process.env.GITHUB_WORKSPACE}/`, "");
}

function levelToAnnotationLevel(level) {
    switch (level) {
        case "error":
            return "failure";
        case "warning":
            return "warning";
        case "info":
            return "notice";
    }
}
