import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { IdeaEditor } from './components/IdeaEditor'
import { ExperimentEditor } from './components/ExperimentEditor'
import { ContentEditor } from './components/ContentEditor'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Dashboard } from './pages/Dashboard'
import { Ideas } from './pages/Ideas'
import { Content } from './pages/Content'
import { ContentView } from './pages/ContentView'
import { CampaignDetail } from './pages/CampaignDetail'
import { Pipeline } from './pages/Pipeline'
import { ContentDetail } from './pages/ContentDetail'
import { Experiments } from './pages/Experiments'
import { Insights } from './pages/Insights'

export default function App() {
  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        <Route
          path="/ideas"
          element={
            <Layout>
              <Ideas />
            </Layout>
          }
        />
        <Route
          path="/content"
          element={
            <Layout>
              <Content />
            </Layout>
          }
        />
        <Route
          path="/content/:id"
          element={
            <Layout>
              <ContentView />
            </Layout>
          }
        />
        <Route
          path="/campaigns/:id"
          element={
            <Layout>
              <CampaignDetail />
            </Layout>
          }
        />
        <Route
          path="/pipeline"
          element={
            <Layout>
              <Pipeline />
            </Layout>
          }
        />
        <Route
          path="/experiments"
          element={
            <Layout>
              <Experiments />
            </Layout>
          }
        />
        <Route
          path="/insights"
          element={
            <Layout>
              <Insights />
            </Layout>
          }
        />
        <Route
          path="/items/:id"
          element={
            <Layout>
              <ContentDetail />
            </Layout>
          }
        />
        <Route
          path="*"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
      </Routes>
      <IdeaEditor />
      <ExperimentEditor />
      <ContentEditor />
      <ConfirmDialog />
    </>
  )
}
