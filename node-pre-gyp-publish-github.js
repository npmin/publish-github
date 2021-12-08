'use strict';

import fs from 'fs';
import path from 'path';
import { findUpSync } from 'find-up';

import * as octokit from '@octokit/rest';

var cwd = process.cwd();

class NodePreGypGithub {
    constructor() {
        var url, hostPrefix;

        this.package_json = JSON.parse(fs.readFileSync(findUpSync('package.json')));

        if (url = this.package_json.binary?.host ?? this.package_json.repository?.url) {
            try {
                var binHost = new URL(url);
            }
            catch {
                throw new Error(`malformed URL in binary.host within package.json: '${url}'`);
            }
            var [owner, repo] = binHost.pathname.split('/').filter(x => x);
            this.host = 'api.' + binHost.hostname;
            this.owner = owner;
            this.repo = repo.replace(/\.git$/, '');
        }
        else {
            throw new Error('required either repository.url or binary.host in package.json');
        }

        this.octokit = new octokit.Octokit({
            auth: this.authenticate_settings(),
            baseUrl: 'https://' + this.host,
            headers: {
                'user-agent': (this.package_json.name) ? this.package_json.name : 'node-pre-gyp-github'
            }
        });

    }
    authenticate_settings() {
        var token = process.env.NODE_PRE_GYP_GITHUB_TOKEN;
        if (!token)
            throw new Error('NODE_PRE_GYP_GITHUB_TOKEN environment variable not found');
        return token;
    }
    async createRelease(args) {
        var options = {
            'host': this.host,
            'owner': this.owner,
            'repo': this.repo,
            'tag_name': this.package_json.version,
            'target_commitish': 'develop',
            'name': 'v' + this.package_json.version,
            'body': this.package_json.name + ' ' + this.package_json.version,
            'draft': true,
            'prerelease': false
        };

        Object.keys(args).forEach(function (key) {
            if (args.hasOwnProperty(key) && options.hasOwnProperty(key)) {
                options[key] = args[key];
            }
        });
        return this.octokit.repos.createRelease(options);
    }
    async uploadAssets() {
        var asset;
        console.log(`${this.owner}/${this.repo}#${this.release.tag_name}`);
        console.log('Stage directory path: ' + path.join(this.stage_dir));
        fs.readdir(path.join(this.stage_dir), async (err, files) => {
            if (err)
                throw err;

            if (!files.length)
                throw new Error('No files found within the stage directory: ' + this.stage_dir);

            var preexisting = 0;

            for (let file of files) {
                process.stdout.write(`[${file}]`);
                if (this.release && this.release.assets) {
                    asset = this.release.assets.filter(function (element, index, array) {
                        return element.name === file;
                    });
                    if (asset.length) {
                        process.stdout.write(' already exists\n');
                        preexisting++;
                        continue;
                    }
                }

                const full = path.join(this.stage_dir, file);
                await this.octokit.repos.uploadReleaseAsset({
                    data: fs.readFileSync(full),
                    owner: this.owner,
                    release_id: this.release.id,
                    repo: this.repo,
                    name: file,
                });
                process.stdout.write(' uploaded\n');
            }

            if (preexisting)
                console.log(`\n  ${preexisting} file(s) were skipped because they already exist in this release.\n` +
                    `  If you would like to overwrite them, delete them first from the GitHub release page.`);
        });
    }
    async publish(options) {
        options = (typeof options === 'undefined') ? {} : options;
        const data = await this.octokit.repos.listReleases({
            'owner': this.owner,
            'repo': this.repo
        });

        var release;
        // when remote_path is set expect files to be in stage_dir / remote_path after substitution
        if (this.package_json.binary.remote_path) {
            options.tag_name = this.package_json.binary.remote_path.replace(/\{version\}/g, this.package_json.version);
            this.stage_dir = path.join(this.stage_dir, options.tag_name);
        } else {
            // This is here for backwards compatibility for before binary.remote_path support was added in version 1.2.0.
            options.tag_name = this.package_json.version;
        }

        release = data.data.filter(function (element, index, array) {
            return element.tag_name === options.tag_name;
        });

        if (release.length === 0) {
            try {
                const release = await this.createRelease(options);
            }
            catch (e) {
                console.log(`Failed to create release; ${e}\n` +
                    `You may need to create the release first from the GitHub releases page:\n` +
                    `  https://github.com/${this.owner}/${this.repo}/releases`);
                return;
            }
            this.release = release.data;
            if (this.release.draft) {
                console.log(`Release ${release.tag_name} not found, so a draft release was created.\n
                    YOU MUST MANUALLY PUBLISH THIS DRAFT WITHIN GITHUB FOR IT TO BE ACCESSIBLE.`);
            }
            else {
                console.log(`Release ${release.tag_name} not found, so a new release was created and published.`);
            }
        }
        else {
            this.release = release[0];
        }

        this.uploadAssets();
    }
}
NodePreGypGithub.prototype.stage_dir = path.join(cwd, 'build', 'stage');

export default NodePreGypGithub;
