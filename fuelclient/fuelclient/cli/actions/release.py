#    Copyright 2014 Mirantis, Inc.
#
#    Licensed under the Apache License, Version 2.0 (the "License"); you may
#    not use this file except in compliance with the License. You may obtain
#    a copy of the License at
#
#         http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
#    WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
#    License for the specific language governing permissions and limitations
#    under the License.

from collections import defaultdict
import os

from fuelclient.cli.actions.base import Action
from fuelclient.cli.actions.base import check_all
from fuelclient.cli.actions.base import check_any
import fuelclient.cli.arguments as Args
from fuelclient.cli.arguments import group
from fuelclient.cli.formatting import format_table
from fuelclient.cli import utils
from fuelclient.objects.release import Release


class ReleaseAction(Action):
    """List and modify currently available releases
    """
    action_name = "release"

    def __init__(self):
        super(ReleaseAction, self).__init__()
        self.args = [
            Args.get_release_arg('Specify particular release id'),
            Args.get_list_arg("List all available releases."),
            Args.get_network_arg("Release network configuration."),
            Args.get_deployment_tasks_arg("Release tasks configuration."),
            Args.get_sync_deployment_tasks_arg(),
            Args.get_dir_arg(
                "Select directory to which download release attributes"),
            group(
                Args.get_download_arg(
                    "Download configuration of specific release"),
                Args.get_upload_arg(
                    "Upload configuration to specific release")
            )
        ]
        self.flag_func_map = (
            ('sync-deployment-tasks', self.sync_deployment_tasks),
            ('deployment-tasks', self.deployment_tasks),
            ('network', self.network),
            (None, self.list),
        )

    def list(self, params):
        """Print all available releases:
                fuel release --list

           Print release with specific id=1:
                fuel release --rel 1
        """
        acceptable_keys = (
            "id",
            "name",
            "state",
            "operating_system",
            "version"
        )
        if params.release:
            release = Release(params.release)
            data = [release.get_fresh_data()]
        else:
            data = Release.get_all_data()
        self.serializer.print_to_output(
            data,
            format_table(
                data,
                acceptable_keys=acceptable_keys
            )
        )

    @check_all("release")
    @check_any("download", "upload")
    def network(self, params):
        """Modify release networks configuration.
        fuel rel --rel 1 --network --download
        fuel rel --rel 2 --network --upload
        """
        release = Release(params.release)
        dir_path = self.full_path_directory(
            params.dir, 'release_{0}'.format(params.release))
        full_path = '{0}/networks'.format(dir_path)
        if params.download:
            networks = release.get_networks()
            self.serializer.write_to_file(full_path, networks)
            print("Networks for release {0} "
                  "downloaded into {1}.yaml".format(release.id, full_path))
        elif params.upload:
            networks = self.serializer.read_from_file(full_path)
            release.update_networks(networks)
            print("Networks for release {0} uploaded from {1}.yaml".format(
                release.id, full_path))

    @check_all("release")
    @check_any("download", "upload")
    def deployment_tasks(self, params):
        """Modify deployment_tasks for release.
        fuel rel --rel 1 --deployment-tasks --download
        fuel rel --rel 1 --deployment-tasks --upload
        """
        release = Release(params.release)
        dir_path = self.full_path_directory(
            params.dir, 'release_{0}'.format(params.release))
        full_path = '{0}/deployment_tasks'.format(dir_path)
        if params.download:
            tasks = release.get_deployment_tasks()
            self.serializer.write_to_file(full_path, tasks)
            print("Deployment tasks for release {0} "
                  "downloaded into {1}.yaml.".format(release.id, full_path))
        elif params.upload:
            tasks = self.serializer.read_from_file(full_path)
            release.update_deployment_tasks(tasks)
            print("Deployment tasks for release {0}"
                  " uploaded from {1}.yaml".format(release.id, dir_path))

    @check_all("dir")
    def sync_deployment_tasks(self, params):
        """Upload tasks for different releases based on directories.
        Unique identifier of the release should in the path, like:

            /etc/puppet/2014.2-6.0/

        fuel rel --sync-deployment-tasks --dir /etc/puppet/2014.2-6.0/

        In case no directory will be provided:

        fuel rel --sync-deployment-tasks

        Current directory will be used
        """
        all_rels = Release.get_all_data()
        real_path = os.path.realpath(params.dir)
        files = list(utils.iterfiles(real_path, ('tasks.yaml',)))
        serialized_tasks = defaultdict(list)
        versions = set([r['version'] for r in all_rels])

        for file_name in files:
            for version in versions:
                if version in file_name:
                    serialized_tasks[version].extend(
                        self.serializer.read_from_full_path(file_name))

        for rel in all_rels:
            release = Release(rel['id'])
            data = serialized_tasks.get(rel['version'])
            if data:
                release.update_deployment_tasks(data)
                print("Deployment tasks syncronized for release"
                      " {0} of version {1}".format(rel['name'],
                                                   rel['version']))
            else:
                print("No tasks found for release {0} "
                      "of version {1}".format(rel['name'], rel['version']))
