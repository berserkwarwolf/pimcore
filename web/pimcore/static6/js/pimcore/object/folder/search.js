/**
 * Pimcore
 *
 * This source file is available under two different licenses:
 * - GNU General Public License version 3 (GPLv3)
 * - Pimcore Enterprise License (PEL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 * @copyright  Copyright (c) Pimcore GmbH (http://www.pimcore.org)
 * @license    http://www.pimcore.org/license     GPLv3 and PEL
 */

pimcore.registerNS("pimcore.object.search");
pimcore.object.search = Class.create(pimcore.object.helpers.gridTabAbstract, {
    systemColumns: ["id", "fullpath", "type", "subtype", "filename", "classname", "creationDate", "modificationDate"],
    fieldObject: {},

    title: t('search_edit'),
    icon: "pimcore_icon_search",
    onlyDirectChildren: false,

    sortinfo: {},
    initialize: function (object, searchType) {
        this.object = object;
        this.element = object;
        this.searchType = searchType;
        this.noBatchColumns = [];
    },

    getLayout: function () {

        if (this.layout == null) {

            // check for classtypes inside of the folder if there is only one type don't display the selection
            var toolbarConfig;

            if (this.object.data.classes && typeof this.object.data.classes == "object") {

                if (this.object.data.classes.length < 1) {
                    return;
                }

                var data = [];
                for (i = 0; i < this.object.data.classes.length; i++) {
                    var klass = this.object.data.classes[i];
                    data.push([klass.id, klass.name, ts(klass.name)]);

                }

                var classStore = new Ext.data.ArrayStore({
                    data: data,
                    sortInfo: {
                        field: 'translatedText',
                        direction: 'ASC'
                    },
                    fields: [
                        {name: 'id', type: 'number'},
                        {name: 'name', type: 'string'},
                        {name: 'translatedText', type: 'string'}
                    ]
                });


                this.classSelector = new Ext.form.ComboBox({
                    name: "selectClass",
                    listWidth: 'auto',
                    store: classStore,
                    queryMode: "local",
                    valueField: 'id',
                    displayField: 'translatedText',
                    triggerAction: 'all',
                    editable: true,
                    typeAhead: true,
                    forceSelection: true,
                    value: this.object.data["selectedClass"],
                    listeners: {
                        "select": this.changeClassSelect.bind(this)
                    }
                });

                if (this.object.data.classes.length > 1) {
                    toolbarConfig = [new Ext.Toolbar.TextItem({
                        text: t("please_select_a_type")
                    }), this.classSelector];
                }
                else {
                    this.currentClass = this.object.data.classes[0].id;
                }
            }
            else {
                return;
            }

            this.layout = new Ext.Panel({
                title: this.title,
                border: false,
                layout: "fit",
                iconCls: this.icon,
                items: [],
                tbar: toolbarConfig
            });

            if (this.currentClass) {
                this.layout.on("afterrender", this.setClass.bind(this, this.currentClass));
            }
        }

        return this.layout;
    },

    changeClassSelect: function (field, newValue, oldValue) {
        var selectedClass = newValue.data.id;
        this.setClass(selectedClass);
    },

    setClass: function (classId) {
        this.classId = classId;
        this.getTableDescription();
    },

    getTableDescription: function () {
        Ext.Ajax.request({
            url: "/admin/object-helper/grid-get-column-config",
            params: {
                id: this.classId,
                objectId:
                this.object.id,
                gridtype: "grid",
                gridConfigId: this.settings ? this.settings.gridConfigId : null,
                searchType: this.searchType
            },
            success: this.createGrid.bind(this, false)
        });
    },


    buildColumnConfigMenu: function () {
        var menu = this.columnConfigButton.getMenu();
        menu.removeAll();

        menu.add({
            text: t('save'),
            iconCls: "pimcore_icon_save",
            disabled: !this.settings.gridConfigId,
            handler: this.saveConfig.bind(this, false)
        });

        menu.add({
            text: t('save_as'),
            iconCls: "pimcore_icon_save",
            handler: this.saveConfig.bind(this, true)
        });

        menu.add({
            text: t('set_as_favourite'),
            iconCls: "pimcore_icon_favourite",
            disabled: !this.settings.gridConfigId,
            handler: function () {
                pimcore.helpers.markColumnConfigAsFavourite(this.object.id, this.classId, this.settings.gridConfigId);
            }.bind(this)
        });

        menu.add({
            text: t('remove_config'),
            iconCls: "pimcore_icon_delete",
            disabled: !this.settings.gridConfigId,
            handler: this.deleteGridConfig.bind(this)
        });

        menu.add('-');

        var text = t('predefined');
        if (!this.settings.gridConfigId) {
            text = "<b>" + text + "</b>";
        }

        menu.add({
            text: text,
            iconCls: "pimcore_icon_gridcolumnconfig",
            gridConfig: {
                id: 0
            },
            handler: this.switchToGridConfig.bind(this)
        });

        if (this.availableConfigs) {

            for (var i = 0; i < this.availableConfigs.length; i++) {
                var config = this.availableConfigs[i];
                var text = config["name"];
                if (config.id == this.settings.gridConfigId) {
                    text = this.settings.gridConfigName,
                        text = "<b>" + text + "</b>";
                }
                var menuConfig = {
                    text: text,
                    iconCls: 'pimcore_icon_gridcolumnconfig',
                    gridConfig: config,
                    handler: this.switchToGridConfig.bind(this)
                }
                menu.add(menuConfig);
            }
        }
    },

    deleteGridConfig: function () {

        Ext.MessageBox.show({
            title: t('delete'),
            msg: t('delete_gridconfig_dblcheck'),
            buttons: Ext.Msg.OKCANCEL,
            icon: Ext.MessageBox.INFO,
            fn: this.deleteGridConfigConfirmed.bind(this)
        });
    },

    deleteGridConfigConfirmed: function (btn) {
        if (btn == 'ok') {
            Ext.Ajax.request({
                url: "/admin/object-helper/grid-delete-column-config",
                params: {
                    id: this.classId,
                    objectId:
                    this.object.id,
                    gridtype: "grid",
                    gridConfigId: this.settings.gridConfigId,
                    searchType: this.searchType
                },
                success: function (response) {

                    decodedResponse = Ext.decode(response.responseText);
                    if (decodedResponse.deleteSuccess) {
                        pimcore.helpers.showNotification(t("success"), t("gridconfig_removed"), "success");
                    } else {
                        pimcore.helpers.showNotification(t("error"), t("gridconfig_not_removed"), "error");
                    }
                    this.createGrid(false, response);
                }.bind(this)
            });
        }
    },

    switchToGridConfig: function (menuItem) {
        var gridConfig = menuItem.gridConfig;
        this.settings.gridConfigId = gridConfig.id;
        this.getTableDescription();
    },

    columnConfigurationSavedHandler: function (rdata) {
        this.settings = rdata.settings;
        this.buildColumnConfigMenu();
    },

    createGrid: function (fromConfig, response, settings, save) {
        var itemsPerPage = pimcore.helpers.grid.getDefaultPageSize(-1);

        var fields = [];
        if (response.responseText) {
            response = Ext.decode(response.responseText);

            if (response.pageSize) {
                itemsPerPage = response.pageSize;
            }

            fields = response.availableFields;
            this.gridLanguage = response.language;
            this.sortinfo = response.sortinfo;

            this.settings = response.settings || {},
                this.availableConfigs = response.availableConfigs;

            if (response.onlyDirectChildren) {
                this.onlyDirectChildren = response.onlyDirectChildren;
            }
        } else {
            fields = response;
            this.settings = settings;
            this.buildColumnConfigMenu();
        }

        this.fieldObject = {};
        for (var i = 0; i < fields.length; i++) {
            this.fieldObject[fields[i].key] = fields[i];
        }

        this.cellEditing = Ext.create('Ext.grid.plugin.CellEditing', {
                clicksToEdit: 1,
                listeners: {
                    beforeedit: function (editor, context, eOpts) {
                        //need to clear cached editors of cell-editing editor in order to
                        //enable different editors per row
                        var editors = editor.editors;
                        editors.each(function (editor) {
                            if (typeof editor.column.config.getEditor !== "undefined") {
                                Ext.destroy(editor);
                                editors.remove(editor);
                            }
                        });
                    }
                }
            }
        );

        var plugins = [this.cellEditing, 'pimcore.gridfilters'];

        // get current class
        var classStore = pimcore.globalmanager.get("object_types_store");
        var klass = classStore.getById(this.classId);

        var gridHelper = new pimcore.object.helpers.grid(
            klass.data.text,
            fields,
            "/admin/object/grid-proxy?classId=" + this.classId + "&folderId=" + this.object.id,
            {
                language: this.gridLanguage,
                // limit: itemsPerPage
            },
            false
        );

        gridHelper.showSubtype = false;
        gridHelper.enableEditor = true;
        gridHelper.limit = itemsPerPage;


        var propertyVisibility = klass.get("propertyVisibility");

        this.store = gridHelper.getStore(this.noBatchColumns);
        if (this.sortinfo) {
            this.store.sort(this.sortinfo.field, this.sortinfo.direction);
        }
        this.store.getProxy().setExtraParam("only_direct_children", this.onlyDirectChildren);
        this.store.setPageSize(itemsPerPage);

        var gridColumns = gridHelper.getGridColumns();

        // add filters
        this.gridfilters = gridHelper.getGridFilters();

        this.languageInfo = new Ext.Toolbar.TextItem({
            text: t("grid_current_language") + ": " + (this.gridLanguage == "default" ? t("default") : pimcore.available_languages[this.gridLanguage])
        });

        this.toolbarFilterInfo = new Ext.Button({
            iconCls: "pimcore_icon_filter_condition",
            hidden: true,
            text: '<b>' + t("filter_active") + '</b>',
            tooltip: t("filter_condition"),
            handler: function (button) {
                Ext.MessageBox.alert(t("filter_condition"), button.pimcore_filter_condition);
            }.bind(this)
        });

        this.clearFilterButton = new Ext.Button({
            iconCls: "pimcore_icon_clear_filters",
            hidden: true,
            text: t("clear_filters"),
            tooltip: t("clear_filters"),
            handler: function (button) {
                this.grid.filters.clearFilters();
                this.toolbarFilterInfo.hide();
                this.clearFilterButton.hide();
            }.bind(this)
        });


        this.createSqlEditor();

        this.checkboxOnlyDirectChildren = new Ext.form.Checkbox({
            name: "onlyDirectChildren",
            style: "margin-bottom: 5px; margin-left: 5px",
            checked: this.onlyDirectChildren,
            boxLabel: t("only_children"),
            listeners: {
                "change": function (field, checked) {
                    this.grid.filters.clearFilters();

                    this.store.getProxy().setExtraParam("only_direct_children", checked);

                    this.onlyDirectChildren = checked;
                    this.pagingtoolbar.moveFirst();
                }.bind(this)
            }
        });

        var hideSaveColumnConfig = !fromConfig || save;

        this.saveColumnConfigButton = new Ext.Button({
            tooltip: t('save_column_configuration'),
            iconCls: "pimcore_icon_publish",
            hidden: hideSaveColumnConfig,
            handler: function () {
                var asCopy = !(this.settings.gridConfigId > 0);
                this.saveConfig(asCopy)
            }.bind(this)
        });

        this.columnConfigButton = new Ext.SplitButton({
            text: t('grid_column_config'),
            iconCls: "pimcore_icon_table_col pimcore_icon_overlay_edit",
            handler: function () {
                this.openColumnConfig();
            }.bind(this),
            menu: []
        });

        this.buildColumnConfigMenu();

        // grid
        this.grid = Ext.create('Ext.grid.Panel', {
            frame: false,
            store: this.store,
            columns: gridColumns,
            columnLines: true,
            stripeRows: true,
            bodyCls: "pimcore_editable_grid",
            border: true,
            selModel: gridHelper.getSelectionColumn(),
            trackMouseOver: true,
            loadMask: true,
            plugins: plugins,
            viewConfig: {
                forceFit: false,
                xtype: 'patchedgridview'
            },
            cls: 'pimcore_object_grid_panel',
            tbar: [this.languageInfo, "-", this.toolbarFilterInfo, this.clearFilterButton, "->", this.checkboxOnlyDirectChildren, "-", this.sqlEditor, this.sqlButton, "-", {
                text: t("search_and_move"),
                iconCls: "pimcore_icon_search pimcore_icon_overlay_go",
                handler: pimcore.helpers.searchAndMove.bind(this, this.object.id,
                    function () {
                        this.store.reload();
                    }.bind(this), "object")
            }, "-", {
                text: t("export_csv"),
                iconCls: "pimcore_icon_export",
                handler: function () {

                    Ext.MessageBox.show({
                        title: t('warning'),
                        msg: t('csv_object_export_warning'),
                        buttons: Ext.Msg.OKCANCEL,
                        fn: function (btn) {
                            if (btn == 'ok') {
                                this.exportPrepare();
                            }
                        }.bind(this),
                        icon: Ext.MessageBox.WARNING
                    });


                }.bind(this)
            }, "-",
                this.columnConfigButton,
                this.saveColumnConfigButton
            ]
        });

        this.grid.on("columnmove", function () {
            this.saveColumnConfigButton.show()
        }.bind(this));
        this.grid.on("columnresize", function () {
            this.saveColumnConfigButton.show()
        }.bind(this));

        this.grid.on("rowcontextmenu", this.onRowContextmenu);

        this.grid.on("afterrender", function (grid) {
            this.updateGridHeaderContextMenu(grid);
        }.bind(this));

        this.grid.on("sortchange", function (ct, column, direction, eOpts) {
            this.sortinfo = {
                field: column.dataIndex,
                direction: direction
            };
        }.bind(this));

        // check for filter updates
        this.grid.on("filterchange", function () {
            this.filterUpdateFunction(this.grid, this.toolbarFilterInfo, this.clearFilterButton);
        }.bind(this));

        gridHelper.applyGridEvents(this.grid);

        this.pagingtoolbar = pimcore.helpers.grid.buildDefaultPagingToolbar(this.store, {pageSize: itemsPerPage});

        this.editor = new Ext.Panel({
            layout: "border",
            items: [new Ext.Panel({
                items: [this.grid],
                region: "center",
                layout: "fit",
                bbar: this.pagingtoolbar
            })]
        });

        this.layout.removeAll();
        this.layout.add(this.editor);
        this.layout.updateLayout();

        if (save) {
            this.saveConfig(false);
        }
    },

    saveConfig: function (asCopy) {
        if (asCopy) {
            this.getSaveAsDialog();
        } else {
            pimcore.helpers.saveColumnConfig(this.object.id, this.classId, this.getGridConfig(), this.searchType, this.saveColumnConfigButton,
                this.columnConfigurationSavedHandler.bind(this), this.settings);
        }
    },

    getSaveAsDialog: function () {
        var defaultName = new Date();

        var nameField = new Ext.form.TextField({
            fieldLabel: t('name'),
            length: 50,
            allowBlank: false,
            value: this.settings.gridConfigName ? this.settings.gridConfigName : defaultName
        });

        var descriptionField = new Ext.form.TextArea({
            fieldLabel: t('description'),
            height: 400,
            value: this.settings.gridConfigDescription
        });

        var configPanel = new Ext.Panel({
            layout: "form",
            bodyStyle: "padding: 10px;",
            items: [nameField, descriptionField],
            buttons: [{
                text: t("save"),
                iconCls: "pimcore_icon_apply",
                handler: function () {
                    this.settings.gridConfigName = nameField.getValue();
                    this.settings.gridConfigDescription = descriptionField.getValue();

                    pimcore.helpers.saveColumnConfig(this.object.id, this.classId, this.getGridConfig(), this.searchType, this.saveColumnConfigButton,
                        this.columnConfigurationSavedHandler.bind(this), this.settings);
                    this.saveWindow.close();
                }.bind(this)
            }]
        });

        this.saveWindow = new Ext.Window({
            width: 600,
            height: 300,
            modal: true,
            title: t('save_as'),
            layout: "fit",
            items: [configPanel]
        });

        this.saveWindow.show();
        nameField.focus();
        nameField.selectText();
        return this.window;
    },


    getGridConfig: function ($super) {
        var config = $super();
        config.onlyDirectChildren = this.onlyDirectChildren;
        config.pageSize = this.pagingtoolbar.pageSize;
        return config;
    },


    onRowContextmenu: function (grid, record, tr, rowIndex, e, eOpts) {

        var menu = new Ext.menu.Menu();
        var data = grid.getStore().getAt(rowIndex);
        var selectedRows = grid.getSelectionModel().getSelection();

        if (selectedRows.length <= 1) {

            menu.add(new Ext.menu.Item({
                text: t('open'),
                iconCls: "pimcore_icon_open",
                handler: function (data) {
                    pimcore.helpers.openObject(data.data.id, "object");
                }.bind(this, data)
            }));

            if (pimcore.elementservice.showLocateInTreeButton("object")) {
                menu.add(new Ext.menu.Item({
                    text: t('show_in_tree'),
                    iconCls: "pimcore_icon_show_in_tree",
                    handler: function () {
                        try {
                            try {
                                pimcore.treenodelocator.showInTree(record.id, "object", this);
                            } catch (e) {
                                console.log(e);
                            }

                        } catch (e2) {
                            console.log(e2);
                        }
                    }
                }));
            }

            menu.add(new Ext.menu.Item({
                text: t('delete'),
                iconCls: "pimcore_icon_delete",
                handler: function (data) {
                    var store = this.getStore();
                    var options = {
                        "elementType": "object",
                        "id": data.data.id,
                        "success": store.reload.bind(this.getStore())
                    };
                    pimcore.elementservice.deleteElement(options);
                }.bind(grid, data)
            }));
        } else {
            menu.add(new Ext.menu.Item({
                text: t('open_selected'),
                iconCls: "pimcore_icon_open",
                handler: function (data) {
                    var selectedRows = grid.getSelectionModel().getSelection();
                    for (var i = 0; i < selectedRows.length; i++) {
                        pimcore.helpers.openObject(selectedRows[i].data.id, "object");
                    }
                }.bind(this, data)
            }));

            menu.add(new Ext.menu.Item({
                text: t('delete_selected'),
                iconCls: "pimcore_icon_delete",
                handler: function (data) {
                    var ids = [];
                    var selectedRows = grid.getSelectionModel().getSelection();
                    for (var i = 0; i < selectedRows.length; i++) {
                        ids.push(selectedRows[i].data.id);
                    }
                    ids = ids.join(',');

                    var options = {
                        "elementType": "object",
                        "id": ids,
                        "success": function () {
                            this.getStore().reload();
                            var tree = pimcore.globalmanager.get("layout_object_tree");
                            var treePanel = tree.tree;
                            tree.refresh(treePanel.getRootNode());
                        }.bind(this)
                    };
                    pimcore.elementservice.deleteElement(options);
                }.bind(grid, data)
            }));
        }

        pimcore.plugin.broker.fireEvent("prepareOnRowContextmenu", menu, this, selectedRows);

        e.stopEvent();
        menu.showAt(e.pageX, e.pageY);
    }


});
