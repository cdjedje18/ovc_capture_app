import React from 'react';
import { Route, Switch } from 'react-router-dom';
import { ViewEventPage } from 'capture-core/components/Pages/ViewEvent';
import { MainPage } from 'capture-core/components/Pages/MainPage';
import { SearchPage } from 'capture-core/components/Pages/Search';
import { NewPage } from 'capture-core/components/Pages/New';
import { EnrollmentPage } from 'capture-core/components/Pages/Enrollment';
import { StageEventListPage } from 'capture-core/components/Pages/StageEvent';
import { EnrollmentEditEventPage } from 'capture-core/components/Pages/EnrollmentEditEvent';
import { EnrollmentAddEventPage } from 'capture-core/components/Pages/EnrollmentAddEvent';
import { MembersFormPage } from 'capture-core/components/Pages/MembersFormPage';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RecoilRoot } from 'recoil';

export const AppPages = () => (
    <>
        <ReactQueryDevtools />
        <RecoilRoot>
            <Switch>
                <Route path="/viewEvent" component={ViewEventPage} />
                <Route path="/search" component={SearchPage} />
                <Route path="/new" component={NewPage} />
                <Route path="/enrollment/stageEvents" component={StageEventListPage} />
                <Route path="/enrollmentEventEdit" component={EnrollmentEditEventPage} />
                <Route path="/enrollmentEventNew" component={EnrollmentAddEventPage} />
                <Route path="/enrollment" component={EnrollmentPage} />
                <Route path="/membersForm" component={MembersFormPage} />
                <Route path="/:keys" component={MainPage} />
                <Route path="/" component={MainPage} />
            </Switch>
        </RecoilRoot>

    </>
);
