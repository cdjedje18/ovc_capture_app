import * as React from 'react';
import { CalendarInput } from '@dhis2/ui';
import i18n from '@dhis2/d2-i18n';
import { withStyles } from 'capture-core-utils/styles';
import type { WithStyles } from 'capture-core-utils/styles';
import { programCollection, systemSettingsStore } from 'capture-core/metaDataMemoryStores';
import { useMainViewConfig } from
    'capture-core/components/Pages/MembersFormPage/MembersFormPageBody/WorkingListsType/EventWorkingListsInit/InitOnline/useMainViewConfig'; // eslint-disable-line max-len
import type { WorkingListTemplates } from './workingListsBase.types';
import { TableHeaderTabsSelector } from './TableHeaderTabsSelector.component';
import { setSelectedMembersVisitDate, useSelectedMembersVisitDate } from './membersVisitDate.store';

const getBorder = (theme: any) => {
    const color = theme.palette.dividerLighter;
    return `${theme.typography.pxToRem(1)} solid ${color}`;
};

const getStyles = (theme: any) => ({
    container: {
        borderBottom: getBorder(theme),
    },
    controlsContainer: {
        display: 'grid',
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        alignItems: 'end',
        columnGap: theme.typography.pxToRem(8),
        width: '100%',
    },
    dateFieldContainer: {
        padding: `${theme.typography.pxToRem(8)} ${theme.typography.pxToRem(8)} ${theme.typography.pxToRem(6)}`,
        gridColumn: 'span 2',
        width: '100%',
        minWidth: 0,
    },
    tabsContainer: {
        gridColumn: 'span 10',
        minWidth: 0,
    },
    titleContainer: {
        padding: `${theme.typography.pxToRem(12)} ${theme.typography.pxToRem(12)} ${theme.typography.pxToRem(10)}`,
    },
    title: {
        ...theme.typography.subtitle1,
        fontWeight: 600,
        margin: 0,
    },
}) as const;

type OwnProps = {
    programId: string;
    templates: WorkingListTemplates;
    currentTemplateId: string;
    currentListIsModified: boolean;
    onSelectTemplate: (template: any) => void;
    selectionInProgress: boolean;
};

type Props = OwnProps & WithStyles<typeof getStyles>;

const TemplateSelectorPlain = ({
    classes,
    programId,
    templates,
    currentTemplateId,
    currentListIsModified,
    onSelectTemplate,
    selectionInProgress,
}: Props) => {
    const selectedDate = useSelectedMembersVisitDate();
    const { dataEntryPrograms } = useMainViewConfig();
    const isMembersFormPage =
        typeof window !== 'undefined' && window.location.href.includes('/membersForm');

    // Keep these props "used" for lint since this component only renders custom header now.
    const templateContextMarker = React.useMemo(
        () => [
            templates?.length || 0,
            currentTemplateId || '',
            String(currentListIsModified),
            String(Boolean(onSelectTemplate)),
            String(selectionInProgress),
        ].join(':'),
        [templates, currentTemplateId, currentListIsModified, onSelectTemplate, selectionInProgress],
    );

    const selectedProgramName = React.useMemo(() => {
        if (isMembersFormPage) {
            return 'Formulário de Registo de Serviços';
        }

        const selectedProgram = programCollection.get(programId);
        return selectedProgram?.name || i18n.t('Lista de Familias');
    }, [isMembersFormPage, programId]);

    const systemSettings = systemSettingsStore.get();
    const calendarType: any = systemSettings.calendar || 'gregory';
    const format: any = systemSettings.dateFormat;
    const locale = systemSettings.uiLocale;
    const visitDateLabel = React.useMemo(() => {
        if (!isMembersFormPage) {
            return 'Data da visita:';
        }

        const currentDataEntryProgram =
            dataEntryPrograms?.find(entry => entry.program === programId) ?? dataEntryPrograms?.[0];
        const currentProgram = programCollection.get(currentDataEntryProgram?.program || '');
        const currentProgramStageId = currentDataEntryProgram?.programStage;
        const currentProgramStage = currentProgramStageId && currentProgram?.getStage(currentProgramStageId);
        const stageAny = currentProgramStage as any;

        const labelFromStage =
            stageAny?.executionDateLabel ||
            stageAny?.displayExecutionDateLabel ||
            currentProgramStage?.stageForm?.getLabel('occurredAt');

        return labelFromStage ? `${labelFromStage}:` : 'Data da visita:';
    }, [dataEntryPrograms, isMembersFormPage, programId]);

    const onDateSelect = React.useCallback(
        (value: { calendarDateString: string } | null) => {
            setSelectedMembersVisitDate(value?.calendarDateString ?? undefined);
        },
        [],
    );

    return (
        <div
            className={classes.container}
            data-template-context={templateContextMarker}
        >
            <div className={classes.titleContainer}>
                <h3 className={classes.title}>{selectedProgramName}</h3>
            </div>
            {isMembersFormPage ? (
                <div className={classes.controlsContainer}>
                    <div
                        data-test="workinglists-template-selector-date-container"
                        className={classes.dateFieldContainer}
                    >
                        <CalendarInput
                            label={visitDateLabel}
                            date={selectedDate}
                            calendar={calendarType}
                            format={format}
                            locale={locale}
                            onDateSelect={onDateSelect}
                        />
                    </div>
                    <div className={classes.tabsContainer}>
                        <TableHeaderTabsSelector programId={programId} />
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export const TemplateSelector = withStyles(getStyles)(TemplateSelectorPlain);
