/*
 * Copyright 2014 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
**/
define(
[
    'underscore',
    'i18n',
    'react',
    'utils',
    'jsx!views/dialogs',
    'jsx!component_mixins'
],
function(_, i18n, React, utils, dialogs, componentMixins) {
    'use strict';

    var clusterPageSubviews = {};

    clusterPageSubviews.ClusterInfo = React.createClass({
        mixins: [
            componentMixins.backboneMixin('model', 'change:name change:status change:release'),
            componentMixins.backboneMixin({
                modelOrCollection: function(props) {return props.model.get('nodes');}
            })
        ],
        render: function() {
            var cluster = this.props.model;
            return (
                <div className='container'>
                    <div className='cluster-name-box'>
                        <div className='cluster-name-placeholder'>
                            <div className='name-box'>
                                <h3 className='name page-title'>{cluster.get('name')}</h3>
                                <div className='node-list-name-count'>({i18n('common.node', {count: cluster.get('nodes').length})})</div>
                                <div className='clearfix'/>
                            </div>
                        </div>
                        <div className='cluster-summary-placeholder'>
                            <div>
                                <strong>{i18n('cluster_page.openstack_release')}: </strong>
                                {cluster.get('release').get('name')} ({cluster.get('release').get('version')})
                            </div>
                            <div>
                                <strong>{i18n('cluster_page.deployment_mode')}: </strong>
                                {i18n('cluster.mode.' + cluster.get('mode'))}
                            </div>
                            <div className={_.contains(['error', 'update_error'], cluster.get('status')) ? 'error' : ''}>
                                <strong>{i18n('cluster_page.environment_status')}: </strong>
                                {i18n('cluster.status.' + cluster.get('status'))}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
    });

    clusterPageSubviews.DeploymentResult = React.createClass({
        mixins: [
            componentMixins.backboneMixin({
                modelOrCollection: function(props) {return props.model.get('tasks');},
                renderOn: 'add remove change:status'
            })
        ],
        dismissTaskResult: function() {
            var task = this.props.model.task({group: 'deployment'});
            if (task) {
                task.destroy();
            }
        },
        render: function() {
            var task = this.props.model.task({group: 'deployment', status: ['ready', 'error']});
            return !task ? (<div/>) : (
                <div className={'alert alert-block ' + (task.match({status: 'error'}) ? 'alert-error global-error' : 'alert-success ' + (task.match({name: ['deploy', 'update']}) ? 'global-success' : 'globalalert'))}>
                    <button className='close' onClick={this.dismissTaskResult}>&times;</button>
                    <h4>{i18n('common.' + (task.match({status: 'error'}) ? 'error' : 'success'))}</h4>
                    <p className='enable-selection' dangerouslySetInnerHTML={{__html: utils.urlify(utils.linebreaks(task.escape('message')))}} />
                </div>
            );
        }
    });

    clusterPageSubviews.DeploymentControl = React.createClass({
        mixins: [,
            componentMixins.backboneMixin('model'),
            componentMixins.backboneMixin({
                modelOrCollection: function(props) {return props.model.get('release');}
            }),
            componentMixins.backboneMixin({
                modelOrCollection: function(props) {return props.model.get('nodes');},
                renderOn: 'add remove change:pending_addition change:pending_deletion'
            }),
            componentMixins.backboneMixin({
                modelOrCollection: function(props) {return props.model.get('tasks');},
                renderOn: 'add remove change'
            })
        ],
        showDialog: function(Dialog) {
            utils.showDialog(Dialog, {cluster: this.props.model});
        },
        onDeployRequest: function() {
            var page = this.props.page;
            if (_.result(page.tab, 'hasChanges')) {
                page.discardSettingsChanges({cb: _.bind(function() {
                    page.tab.revertChanges();
                    this.showDialog(dialogs.DeployChangesDialog);
                }, this)});
            } else {
                this.showDialog(dialogs.DeployChangesDialog);
            }
        },
        render: function() {
            var cluster = this.props.model,
                nodes = cluster.get('nodes'),
                task = cluster.task({group: 'deployment', status: 'running'}),
                taskName = task ? task.get('name') : '',
                taskProgress = task ? task.get('progress') || 0 : 0,
                infiniteTask = _.contains(['stop_deployment', 'reset_environment'], taskName),
                itemClass = 'deployment-control-item-box';
            return task ? (
                    <div className={'pull-right deployment-progress-box ' + taskName}>
                        {!infiniteTask &&
                            <div>
                                {taskName != 'update' &&
                                    <div className={itemClass}>
                                        <button
                                            className='btn btn-danger stop-deployment-btn'
                                            title={i18n('cluster_page.stop_deployment_button')}
                                            onClick={_.bind(this.showDialog, this, dialogs.StopDeploymentDialog)}
                                        >
                                            <i className='icon-cancel-circle' />
                                        </button>
                                    </div>
                                }
                                <div className={itemClass}>
                                    <div className='deploying-progress-text-box percentage'>{taskProgress + '%'}</div>
                                </div>
                            </div>
                        }
                        <div className={itemClass}>
                            <div className={'progress progress-striped active progress-' + (infiniteTask ? 'warning' : 'success')}>
                                <div className='bar' style={{width: (taskProgress > 3 ? taskProgress : 3) + '%'}} />
                            </div>
                        </div>
                        <div className='progress-bar-description'>{i18n('cluster_page.' + taskName, {defaultValue: ''})}</div>
                    </div>
                ) : (
                    <div className='pull-right deployment-control-box'>
                        <div className={itemClass}>
                            <button
                                className='deploy-btn'
                                disabled={cluster.get('release').get('state') != 'available' || (!cluster.hasChanges() && !cluster.needsRedeployment()) || nodes.every({status: 'ready', pending_deletion: false})}
                                onClick={this.onDeployRequest}
                            >
                                <i className='icon-upload-cloud' />
                                {i18n('cluster_page.deploy_changes')}
                            </button>
                        </div>
                        {nodes.hasChanges() &&
                            <div className={itemClass}>
                                <button
                                    className='btn rollback'
                                    title={i18n('cluster_page.discard_changes')}
                                    onClick={_.bind(this.showDialog, this, dialogs.DiscardNodeChangesDialog)}
                                >
                                    <i className='icon-back-in-time' />
                                </button>
                            </div>
                        }
                    </div>
                );
        }
    });

    clusterPageSubviews.ClusterCustomizationMessage = React.createClass({
        mixins: [componentMixins.backboneMixin('model', 'change:is_customized')],
        render: function() {
            return !this.props.model.get('is_customized') ? (<div/>) : (
                <div className='alert alert-block globalalert'>
                    <p className='enable-selection'>{i18n('cluster_page.cluster_was_modified_from_cli')}</p>
                </div>
            );
        }
    });

    return clusterPageSubviews;
});
