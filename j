pipeline {
  agent any 
  tools {
    maven 'm3-2-5'
  }
  stages {
    stage ('Initialize') {
      steps {
        sh '''
                    echo "PATH = ${PATH}"
                    echo "M2_HOME = ${M2_HOME}"
            ''' 
      }
    } 
    
/*   stage ('Check-Git-Secrets') {
      steps {
        sh 'sshpass -p Stellantis01 ssh devuser@10.109.137.30 "sudo docker run zricethezav/gitleaks --repo-url=https://github.com/abhi3780/webapp.git --report=gitleaks.json" '
      }
    }     */
    
   stage ('SAST Scan - Snyk ') {
      steps {
      snykSecurity organisation: 'e.vabhilash', projectName: 'abhi3780/webapp', snykInstallation: 'snyk', snykTokenId: 'Snyk_27May_1015PM'
      }
 }
   stage ('Build') {
      steps {
      sh 'mvn clean package -X'
      sh 'ls /var/jenkins_home/workspace/webapp/target'
     }
    }
    
    stage ('Deploy') {
     steps {
     sh 'sshpass -p Stellantis01 ssh devuser@10.109.137.30 "sudo docker cp /var/lib/docker/volumes/d39ec24666c4194ae2555d6b5e7f277a4886cc0876baa53ed51e6bc31cf42fdd/_data/workspace/webapp_pipeline/target/WebApp f545e59a5a7536da1fa8a6c3b9c3e2154485ac6adf6855e0379dd6217778e7c3:/usr/local/tomcat/webapps" '
      sh 'echo -- BROWSE -- http://10.109.137.30:8000/WebApp/'
       }
    }
    stage ('DAST Scan') {
      parallel {
        stage ('Arachni') {
      steps {
         sh 'sshpass -p Stellantis01 ssh devuser@10.109.137.30 "sudo docker exec c2406913789c52e3dc69b680b93f60dc97d64b825f0948f2afbe2a9c95a61678 bash /arachni/bin/./arachni http://10.109.137.30:8000/WebApp/" '
         sh 'echo REPORTS SAVED in /arachni Folder'
        }
    }
      stage ('IBM App Scan') {
      steps {
        appscan application: 'cb595860-1142-4fb9-95cb-eee3d7a0f33e', credentials: 'd4749e0b-a502-42a6-abe6-c9bab6b925ca', name: 'cb595860-1142-4fb9-95cb-eee3d7a0f33e1864', scanner: dynamic_analyzer(hasOptions: false, optimization: 'Fast', scanType: 'Staging', target: 'http://altoromutual.com:8080/login.jsp'), type: 'Dynamic Analyzer'
     }
    }  
   }
  }
 }
}
