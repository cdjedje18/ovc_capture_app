import React, { useEffect, useState, type ComponentType } from 'react';
import { withStyles, type WithStyles } from 'capture-core-utils/styles';
import { cx } from '@emotion/css';
import { TopBar } from './TopBar/TopBar.container';
import { MainPageBody } from './MainPageBody';
import type { MainPageComponentProps } from './mainPage.types';
import { MainPageStatuses } from './shared/constants';
import { Fab } from '@mui/material';
import { IconSettings24 } from '@dhis2/ui';
import ConfigurationModal from './MainPageBody/formDialog/formDialog';
import { useDataStore } from './MainPageBody/formDialog/dataStore/useDataStore';

const styles = {
    containerBulkDataEntry: {
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        height: 'calc(100vh - 48px)',
        '@supports (-webkit-touch-callout: none)': {
            height: 'calc(100vh - 148px)',
        },
    },
};

const MainPageComponentPlain = ({
    programId,
    orgUnitId,
    selectedCategories,
    mainPageStatus,
    trackedEntityTypeId,
    selectedTemplateId,
    onSetShowAccessible,
    onChangeTemplate,
    error,
    ready,
    displayFrontPageList,
    onCloseBulkDataEntryPlugin,
    onOpenBulkDataEntryPlugin,
    bulkDataEntryTrackedEntityIds,
    classes,
}: MainPageComponentProps & WithStyles<typeof styles>) => {
    const [open, setOpen] = useState(false);
    const { data, error: err, loading } = useDataStore()

    return (
        <div
            className={cx({
                [classes.containerBulkDataEntry]: mainPageStatus === MainPageStatuses.SHOW_BULK_DATA_ENTRY_PLUGIN,
            })}
        >
            <TopBar programId={programId} orgUnitId={orgUnitId} selectedCategories={selectedCategories} />
            <MainPageBody
                mainPageStatus={mainPageStatus}
                programId={programId || ''}
                orgUnitId={orgUnitId}
                trackedEntityTypeId={trackedEntityTypeId}
                selectedTemplateId={selectedTemplateId}
                setShowAccessible={onSetShowAccessible}
                onChangeTemplate={onChangeTemplate}
                error={error || false}
                ready={ready}
                displayFrontPageList={displayFrontPageList}
                onCloseBulkDataEntryPlugin={onCloseBulkDataEntryPlugin}
                onOpenBulkDataEntryPlugin={onOpenBulkDataEntryPlugin}
                bulkDataEntryTrackedEntityIds={bulkDataEntryTrackedEntityIds}
            />
            <Fab
                color="primary"
                aria-label="add"
                style={{
                    position: 'fixed',
                    bottom: 16,
                    right: 16,
                }}
                onClick={() => setOpen(true)}
            >
                <IconSettings24 />
            </Fab>

            <ConfigurationModal data={data?.config?.entries} open={open} setOpen={setOpen} />
        </div>
    )
};


export const MainPageComponent =
    withStyles(styles)(MainPageComponentPlain) as ComponentType<MainPageComponentProps>;
