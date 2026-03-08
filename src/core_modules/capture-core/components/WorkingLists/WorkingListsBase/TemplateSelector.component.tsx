import * as React from 'react';
import { CalendarInput } from '@dhis2/ui';
import { withStyles } from 'capture-core-utils/styles';
import type { WithStyles } from 'capture-core-utils/styles';
import { systemSettingsStore } from 'capture-core/metaDataMemoryStores';
import type { WorkingListTemplates } from './workingListsBase.types';
import { TableHeaderTabsSelector } from './TableHeaderTabsSelector.component';

const getBorder = (theme: any) => {
    const color = theme.palette.dividerLighter;
    return `${theme.typography.pxToRem(1)} solid ${color}`;
};

const getStyles = (theme: any) => ({
    container: {
        borderBottom: getBorder(theme),
    },
    controlsContainer: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        width: '100%',
    },
    dateFieldContainer: {
        padding: `${theme.typography.pxToRem(8)} ${theme.typography.pxToRem(8)} ${theme.typography.pxToRem(6)}`,
        maxWidth: theme.typography.pxToRem(280),
    },
}) as const;

type OwnProps = {
    templates: WorkingListTemplates;
    currentTemplateId: string;
    currentListIsModified: boolean;
    onSelectTemplate: (template: any) => void;
    selectionInProgress: boolean;
};

type Props = OwnProps & WithStyles<typeof getStyles>;

const TemplateSelectorPlain = (props: Props) => {
    const {
        classes,
    } = props;
    const [selectedDate, setSelectedDate] = React.useState<string | undefined>('');
    const systemSettings = systemSettingsStore.get();
    const calendarType: any = systemSettings.calendar || 'gregory';
    const format: any = systemSettings.dateFormat;
    const locale = systemSettings.uiLocale;

    const onDateSelect = React.useCallback(
        (value: { calendarDateString: string } | null) => {
            setSelectedDate(value?.calendarDateString ?? '');
        },
        [],
    );

    return (
        <div
            className={classes.container}
        >
            <div className={classes.controlsContainer}>
                <div
                    data-test="workinglists-template-selector-date-container"
                    className={classes.dateFieldContainer}
                >
                    <CalendarInput
                        label="Date"
                        date={selectedDate}
                        calendar={calendarType}
                        format={format}
                        locale={locale}
                        onDateSelect={onDateSelect}
                    />
                </div>
                <TableHeaderTabsSelector />
            </div>
        </div>
    );
};

export const TemplateSelector = withStyles(getStyles)(TemplateSelectorPlain);
