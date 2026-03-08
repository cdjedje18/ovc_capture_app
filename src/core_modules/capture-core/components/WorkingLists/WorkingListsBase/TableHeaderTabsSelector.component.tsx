import * as React from 'react';
import i18n from '@dhis2/d2-i18n';
import { Tab, TabBar } from '@dhis2/ui';
import { withStyles } from 'capture-core-utils/styles';
import type { WithStyles } from 'capture-core-utils/styles';

const getStyles = (theme: any) => ({
    container: {
        minWidth: theme.typography.pxToRem(260),
        padding: `${theme.typography.pxToRem(8)} ${theme.typography.pxToRem(8)} ${theme.typography.pxToRem(6)}`,
    },
}) as const;

type Props = WithStyles<typeof getStyles>;

const TableHeaderTabsSelectorPlain = ({ classes }: Props) => {
    const sectionLabels = React.useMemo(
        () => Array.from({ length: 7 }, (_, index) => i18n.t('Section {{number}}', { number: index + 1 })),
        [],
    );
    const [activeTab, setActiveTab] = React.useState(sectionLabels[0]);

    return (
        <div className={classes.container} data-test="workinglists-table-header-tabs-container">
            <TabBar dataTest="workinglists-table-header-tabs">
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
