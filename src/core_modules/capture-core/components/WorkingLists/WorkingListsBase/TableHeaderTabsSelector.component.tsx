import * as React from 'react';
import { Tab, TabBar } from '@dhis2/ui';
import { withStyles } from 'capture-core-utils/styles';
import type { WithStyles } from 'capture-core-utils/styles';
import { useMainViewConfig } from 'capture-core/components/Pages/MembersFormPage/MembersFormPageBody/WorkingListsType/EventWorkingListsInit/InitOnline/useMainViewConfig';
import { programCollection } from 'capture-core/metaDataMemoryStores';
import { setSelectedMembersSection, useSelectedMembersSection } from './membersSectionSelection.store';

const getStyles = (theme: any) => ({
    container: {
        width: '100%',
        minWidth: 0,
        padding: `${theme.typography.pxToRem(8)} ${theme.typography.pxToRem(8)} ${theme.typography.pxToRem(6)}`,
    },
}) as const;

type Props = WithStyles<typeof getStyles>;
type OwnProps = {
    programId: string;
};

const TableHeaderTabsSelectorPlain = ({ classes, programId }: Props & OwnProps) => {
    const { dataEntryPrograms } = useMainViewConfig();

    const currentDataEntryProgram = React.useMemo(
        () => dataEntryPrograms?.find(entry => entry.program === programId) ?? dataEntryPrograms?.[0],
        [dataEntryPrograms, programId],
    );
    const currentProgram = programCollection.get(currentDataEntryProgram?.program || '');
    const currentProgramStage = currentDataEntryProgram?.programStage || '';
    const selectedSectionId = useSelectedMembersSection(currentProgramStage);

    const sectionsFromProgramStage = React.useMemo(() => {
        const programStage = currentProgram?.getStage(currentProgramStage);
        if (!programStage) {
            return [];
        }

        return Array.from(programStage.stageForm.sections.values())
            .filter(section => section.visible && section.name)
            .map(section => ({
                id: section.id,
                name: section.name,
            }));
    }, [currentProgram, currentProgramStage]);

    const [activeTab, setActiveTab] = React.useState<string | undefined>(sectionsFromProgramStage[0]?.id);

    React.useEffect(() => {
        const selectedSectionStillVisible =
            selectedSectionId && sectionsFromProgramStage.some(section => section.id === selectedSectionId);
        const nextSectionId = selectedSectionStillVisible ? selectedSectionId : sectionsFromProgramStage[0]?.id;

        if (nextSectionId !== activeTab) {
            setActiveTab(nextSectionId);
        }
        setSelectedMembersSection(currentProgramStage, nextSectionId);
    }, [sectionsFromProgramStage, activeTab, selectedSectionId, currentProgramStage]);

    const handleTabClick = React.useCallback((sectionId: string) => {
        setActiveTab(sectionId);
        setSelectedMembersSection(currentProgramStage, sectionId);

    }, [currentProgramStage]);

    if (!sectionsFromProgramStage.length) {
        return null;
    }

    return (
        <div className={classes.container} data-test="workinglists-table-header-tabs-container">
            <TabBar dataTest="workinglists-table-header-tabs" scrollable>
                {sectionsFromProgramStage.map(section => (
                    <Tab
                        key={section.id}
                        selected={activeTab === section.id}
                        onClick={() => handleTabClick(section.id)}
                    >
                        {section.name}
                    </Tab>
                ))}
            </TabBar>
        </div>
    );
};

export const TableHeaderTabsSelector = withStyles(getStyles)(TableHeaderTabsSelectorPlain);
