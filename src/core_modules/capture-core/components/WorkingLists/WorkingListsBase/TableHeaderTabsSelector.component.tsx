import * as React from 'react';
import { Tab, TabBar } from '@dhis2/ui';
import { withStyles } from 'capture-core-utils/styles';
import type { WithStyles } from 'capture-core-utils/styles';
import { useMainViewConfig } from 'capture-core/components/Pages/MembersFormPage/MembersFormPageBody/WorkingListsType/EventWorkingListsInit/InitOnline/useMainViewConfig';
import { programCollection } from 'capture-core/metaDataMemoryStores';

const getStyles = (theme: any) => ({
    container: {
        width: '100%',
        minWidth: 0,
        padding: `${theme.typography.pxToRem(8)} ${theme.typography.pxToRem(8)} ${theme.typography.pxToRem(6)}`,
    },
}) as const;

type Props = WithStyles<typeof getStyles>;

const TableHeaderTabsSelectorPlain = ({ classes }: Props) => {
    const { dataEntryPrograms } = useMainViewConfig();

    const currentProgram = programCollection.get(dataEntryPrograms?.[0]?.program || '');
    const currentProgramStage = dataEntryPrograms?.[0]?.programStage || '';

    const sectionLabelsFromProgramStage = React.useMemo(() => {
        const programStage = currentProgram?.getStage(currentProgramStage);
        if (!programStage) {
            return [];
        }

        return Array.from(programStage.stageForm.sections.values())
            .filter(section => section.visible && section.name)
            .map(section => section.name);
    }, [currentProgram, currentProgramStage]);

    const sectionLabels = React.useMemo(
        () =>
            sectionLabelsFromProgramStage.length > 0
                ? sectionLabelsFromProgramStage
                : [],
        [sectionLabelsFromProgramStage],
    );
    const [activeTab, setActiveTab] = React.useState<string | undefined>(sectionLabels[0]);

    React.useEffect(() => {
        if (!activeTab || !sectionLabels.includes(activeTab)) {
            setActiveTab(sectionLabels[0]);
        }
    }, [sectionLabels, activeTab]);

    return (
        <div className={classes.container} data-test="workinglists-table-header-tabs-container">
            <TabBar dataTest="workinglists-table-header-tabs" scrollable>
                {sectionLabels.map(label => (
                    <Tab
                        key={label}
                        selected={activeTab === label}
                        onClick={() => setActiveTab(label)}
                    >
                        {label}
                    </Tab>
                ))}
            </TabBar>
        </div>
    );
};

export const TableHeaderTabsSelector = withStyles(getStyles)(TableHeaderTabsSelectorPlain);
