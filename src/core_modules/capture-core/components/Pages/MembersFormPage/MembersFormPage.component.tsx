import React, { type ComponentType } from 'react';
import { withStyles, type WithStyles } from 'capture-core-utils/styles';
import { cx } from '@emotion/css';
import { TopBar } from './TopBar/TopBar.container';
import { MembersFormPageBody } from './MembersFormPageBody';
import type { MainPageComponentProps } from './membersFormPage.types';
import { MainPageStatuses } from './shared/constants';
import { RecoilRoot } from 'recoil';

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
    sourceProgramId,
    entryProgramId,
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
}: MainPageComponentProps & WithStyles<typeof styles>) => (
    <div
        className={cx({
            [classes.containerBulkDataEntry]: mainPageStatus === MainPageStatuses.SHOW_BULK_DATA_ENTRY_PLUGIN,
        })}
    >
        <TopBar
            sourceProgramId={sourceProgramId}
            entryProgramId={entryProgramId}
            orgUnitId={orgUnitId}
            selectedCategories={selectedCategories}
        />
        <RecoilRoot>
            <MembersFormPageBody
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
        </RecoilRoot>
    </div>
);


export const MembersFormPageComponent =
    withStyles(styles)(MainPageComponentPlain) as ComponentType<MainPageComponentProps>;
