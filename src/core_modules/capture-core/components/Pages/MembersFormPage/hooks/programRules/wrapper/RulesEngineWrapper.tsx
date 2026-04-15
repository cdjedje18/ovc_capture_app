import React, { Fragment } from 'react';
import FetchEngineVariables from './FetchEngineVariables';
import { Center, CircularLoader, NoticeBox } from '@dhis2/ui';
import { RulesEngineWrapperProps } from '../../../types/programRules/RulesEngineProps';

/**
 * A component to initialize all required variables to run program rules.
 * @param {RulesEngineWrapperProps} props - The wrapper properties.
 * @returns {*} A JSX component which renders circular loader, error messages or wrapper children based whith the initializer status.
 */
export default function RulesEngineWrapper(props: RulesEngineWrapperProps) {
    const { programs } = props;
    const { loading, error } = FetchEngineVariables(programs);

    // if (loading) {
    //     return (
    //         <Center>
    //             <CircularLoader />
    //         </Center>
    //     )
    // }

    if (error) {
        return (
            <Center>
                <NoticeBox
                    error
                    title="Error loading Program Rules"
                >
                    Something went wrong loading the app program rules. Check if your app is already configured.
                </NoticeBox>
            </Center>
        );
    }

    return (
        <Fragment>
            {props.children}
        </Fragment>
    );
}
